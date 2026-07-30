#!/usr/bin/env python3
"""
Demeter Daily Backup

Creates a non-sensitive operational backup for DataSeed/Demeter and pushes it
back to the same GitHub branch used for critical recovery.

Safety policy:
- Only writes markdown and safe helper scripts into the repository.
- Task-log and daily-summary are referenced, not copied into the backup.
- Only large completed cycles are copied into the backup task section.
- Never copies .env, OAuth credentials, auth.json, WhatsApp sessions, databases,
  logs, caches, or user attachments.
- Cron prompts and delivery targets are intentionally excluded.
"""
from __future__ import annotations

import json
import os
import platform
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore

HERMES_HOME = Path(os.environ.get("HERMES_HOME", "/opt/data")).resolve()
REPO_URL = os.environ.get("DATASEED_BACKUP_REPO", "https://github.com/contacto101/data_seed.git")
# Use a dedicated clone for the backup job. The live /opt/data/data_seed
# worktree is used by normal DataSeed tasks and may have local graph changes;
# switching or pulling it from cron can fail or disrupt active work.
REPO_DIR = Path(os.environ.get("DATASEED_REPO_DIR", str(HERMES_HOME / "data_seed_daily_backup"))).resolve()
DEFAULT_BACKUP_REPO_DIR = (HERMES_HOME / "data_seed_daily_backup").resolve()
BRANCH = os.environ.get("DATASEED_BACKUP_BRANCH", "main")
HERMES_BIN = Path(os.environ.get("HERMES_BIN", "/opt/hermes/.venv/bin/hermes"))
SCRIPT_SOURCE = Path(__file__).resolve()
GITHUB_API_HELPER = Path(os.environ.get("DATASEED_GITHUB_API_COMMIT_HELPER", str(HERMES_HOME / "scripts" / "github_api_commit.py"))).resolve()
CANONICAL_REPO_DIR = Path(os.environ.get("DATASEED_CANONICAL_REPO_DIR", str(HERMES_HOME / "data_seed"))).resolve()
DEFAULT_TASK_TRACKING_REPO_DIR = (HERMES_HOME / "data_seed_tasklog_worktree").resolve()
if "DATASEED_TASK_TRACKING_REPO_DIR" in os.environ:
    TASK_TRACKING_REPO_DIR = Path(os.environ["DATASEED_TASK_TRACKING_REPO_DIR"]).resolve()
elif (DEFAULT_TASK_TRACKING_REPO_DIR / "task-log.md").exists():
    TASK_TRACKING_REPO_DIR = DEFAULT_TASK_TRACKING_REPO_DIR
else:
    TASK_TRACKING_REPO_DIR = CANONICAL_REPO_DIR
GRAPHIFY_SOURCE_REPO_DIR = Path(
    os.environ.get("DATASEED_GRAPHIFY_SOURCE_REPO_DIR", str(CANONICAL_REPO_DIR))
).resolve()
TASK_TRACKING_BRANCH = os.environ.get("DATASEED_TASK_TRACKING_BRANCH", "feat/task-tracking-system")
TASK_LOG_REPO_REL = "task-log.md"
DAILY_SUMMARY_REPO_REL = "daily-summary.md"
COMPLETED_CYCLES_REPO_REL = "backups/COMPLETED_CYCLES.md"
COMPLETED_CYCLES_SOURCE = Path(
    os.environ.get(
        "DATASEED_COMPLETED_CYCLES_SOURCE",
        str(TASK_TRACKING_REPO_DIR / COMPLETED_CYCLES_REPO_REL),
    )
).resolve()

REPORTING_DOC_OUTPUTS = [
    "backups/reporting/AUTOMATIZACION_UNIFICADA_DE_REPORTES.md",
    "backups/reporting/README__SISTEMA_DE_REPORTES.md",
    "backups/reporting/PLANTILLA_BASE__REPORTE_DE_AREA__v1.md",
    "backups/reporting/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md",
    "backups/reporting/areas/PLANTILLA__DIRECCION_Y_ESTRATEGIA__v1.md",
    "backups/reporting/areas/PLANTILLA__PRODUCTO__v1.md",
    "backups/reporting/areas/PLANTILLA__INGENIERIA_Y_TECNOLOGIA__v1.md",
    "backups/reporting/areas/PLANTILLA__DATOS_E_IA__v1.md",
    "backups/reporting/areas/PLANTILLA__VENTAS__v1.md",
    "backups/reporting/areas/PLANTILLA__MARKETING_Y_GROWTH__v1.md",
    "backups/reporting/areas/PLANTILLA__EXITO_DEL_CLIENTE_Y_SOPORTE__v1.md",
    "backups/reporting/areas/PLANTILLA__OPERACIONES__v1.md",
    "backups/reporting/areas/PLANTILLA__FINANZAS__v1.md",
    "backups/reporting/areas/PLANTILLA__PERSONAS_Y_CULTURA__v1.md",
    "backups/reporting/areas/PLANTILLA__LEGAL_RIESGOS_Y_SEGURIDAD__v1.md",
]

REPORTING_TEST_OUTPUTS = [
    "scripts/ops/tests/reporting/canonical-end-to-end-test.sh",
    "scripts/ops/tests/reporting/runtime-backup-parity-test.sh",
    "scripts/ops/tests/reporting/snapshot-retry-test.sh",
    "scripts/ops/tests/reporting/drive-idempotency-invariants-test.py",
    "scripts/ops/tests/reporting/deterministic-retry-test.sh",
    "scripts/ops/tests/reporting/transaction-guard-test.sh",
    "scripts/ops/tests/reporting/production-guards-test.sh",
    "scripts/ops/tests/reporting/template-validation-test.sh",
    "scripts/ops/tests/reporting/secret-redaction-test.sh",
    "scripts/ops/tests/reporting/template-missing-test.sh",
    "scripts/ops/tests/reporting/template-usage-test.sh",
    "scripts/ops/tests/reporting/template-catalog-test.py",
    "scripts/ops/tests/reporting/fixtures/daily-summary-empty.md",
    "scripts/ops/tests/reporting/fixtures/task-log-template.md",
    "scripts/ops/tests/reporting/fingerprint-collision-test.sh",
    "scripts/ops/tests/reporting/failure-preservation-test.sh",
    "scripts/ops/tests/reporting/fake-reporter.js",
    "scripts/ops/tests/reporting/integration-test.sh",
    "scripts/ops/tests/reporting/fake-backup.py",
    "scripts/ops/tests/reporting/fake-graph.py",
]

ALLOWED_REPO_OUTPUTS = [
    "backups/BACKUP.md",
    COMPLETED_CYCLES_REPO_REL,
    "backups/RESTORE_GUIDE.md",
    "backups/restore.sh",
    *REPORTING_DOC_OUTPUTS,
    *REPORTING_TEST_OUTPUTS,
    # Compatibility wrappers kept temporarily so old cron/process paths keep working.
    "scripts/demeter_daily_backup.py",
    "scripts/daily-operations.sh",
    "scripts/daily-operations-wrapper.sh",
    # Canonical operational scripts.
    "scripts/ops/demeter_daily_backup.py",
    "scripts/ops/daily-operations.sh",
    "scripts/ops/daily-operations-wrapper.sh",
    "scripts/ops/daily-task-log-cleanup.sh",
    "scripts/ops/daily-area-reports.js",
    "scripts/ops/github_api_commit.py",
    "scripts/github_api_commit.py",
    "scripts/generate-multibranch-graph.py",
    "graphify-out/GRAPH_REPORT.md",
    "graphify-out/manifest.json",
    "graphify-out/.graphify_labels.json",
]
SAFE_CRON_SCRIPT_EXTENSIONS = {".py", ".sh", ".bash"}
HARD_COPY_ALLOWLIST = HERMES_HOME / "backup_hardcopy_allowlist.txt"
COPIED_CRON_SCRIPT_REPO_PATHS: list[str] = []
CRON_SCRIPT_REVIEW_NOTES: list[str] = []

# Values matching these patterns must not appear in generated backup files.
SECRET_VALUE_PATTERNS = [
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}"),
    re.compile(r"ya29\.[A-Za-z0-9_-]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"https://[^\s:@]+:[^\s:@]{12,}@github\.com"),
]

AGENT_VAULT_CA_CANDIDATES = (
    "/opt/agent-vault-ca.pem",
    "/opt/data/agent-vault/agent-vault-ca.pem",
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_santiago() -> datetime | None:
    if ZoneInfo is None:
        return None
    try:
        return now_utc().astimezone(ZoneInfo("America/Santiago"))
    except Exception:
        return None


def normalize_agent_vault_git_env(env: dict[str, str]) -> None:
    """Make git/libcurl use Agent Vault proxy non-interactively.

    The gateway exports Agent Vault as http://TOKEN@host:port. libcurl used by
    git interprets username-only proxy URLs as needing a password prompt. Agent
    Vault accepts an empty password, so normalize to http://TOKEN:@host:port.
    This preserves the proxy path; it does not bypass Agent Vault.
    """
    for key in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"):
        value = env.get(key)
        if not value or "://" not in value or "@" not in value:
            continue
        scheme, rest = value.split("://", 1)
        userinfo, hostpart = rest.split("@", 1)
        if ":" not in userinfo:
            env[key] = f"{scheme}://{userinfo}:@{hostpart}"
    if not env.get("GIT_SSL_CAINFO"):
        ca = env.get("SSL_CERT_FILE") or env.get("REQUESTS_CA_BUNDLE")
        if ca and Path(ca).exists():
            env["GIT_SSL_CAINFO"] = ca
        else:
            for candidate in AGENT_VAULT_CA_CANDIDATES:
                if Path(candidate).exists():
                    env["GIT_SSL_CAINFO"] = candidate
                    break


def disable_direct_git_credentials(env: dict[str, str]) -> None:
    """Disable direct credentials for raw git subprocesses only.

    GITHUB_TOKEN/GH_TOKEN may be an Agent Vault placeholder for API calls, but
    raw git commands in this script must not fall back to direct PAT helpers or
    ~/.git-credentials. If raw git is not brokered by Agent Vault, it should fail
    closed instead of prompting for or leaking a direct credential.
    """
    for key in ("GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT"):
        env.pop(key, None)
    env["GIT_TERMINAL_PROMPT"] = "0"
    if Path("/bin/false").exists():
        env["GIT_ASKPASS"] = "/bin/false"
        env["SSH_ASKPASS"] = "/bin/false"
    else:
        env.pop("GIT_ASKPASS", None)
        env.pop("SSH_ASKPASS", None)
    try:
        count = int(env.get("GIT_CONFIG_COUNT", "0") or "0")
    except ValueError:
        count = 0
    env[f"GIT_CONFIG_KEY_{count}"] = "credential.helper"
    env[f"GIT_CONFIG_VALUE_{count}"] = ""
    env["GIT_CONFIG_COUNT"] = str(count + 1)


def run(cmd: list[str], cwd: Path | None = None, check: bool = True, extra_env: dict[str, str] | None = None) -> str:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    if cmd and cmd[0] == "git":
        disable_direct_git_credentials(env)
        normalize_agent_vault_git_env(env)
    proc = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    out = sanitize_text(out)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{out.strip()}")
    return out.strip()


def sanitize_text(text: str) -> str:
    clean = text
    for pat in SECRET_VALUE_PATTERNS:
        clean = pat.sub("<redacted-secret>", clean)
    return clean


def assert_no_secret_values(label: str, text: str) -> None:
    for pat in SECRET_VALUE_PATTERNS:
        if pat.search(text):
            raise RuntimeError(f"Refusing to write {label}: secret-like value detected by {pat.pattern}")


def ensure_brokered_git_auth() -> None:
    os.environ.setdefault("HOME", str(HERMES_HOME / "home"))
    os.environ["GIT_TERMINAL_PROMPT"] = "0"
    if Path("/bin/false").exists():
        os.environ["GIT_ASKPASS"] = "/bin/false"
        os.environ["SSH_ASKPASS"] = "/bin/false"
    else:
        os.environ.pop("GIT_ASKPASS", None)
        os.environ.pop("SSH_ASKPASS", None)
    for key in ("GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT"):
        os.environ.pop(key, None)
    Path(os.environ["HOME"]).mkdir(parents=True, exist_ok=True)


def clean_backup_repo_if_needed() -> None:
    """Discard stale generated output in the dedicated backup clone before pull.

    The daily backup writes only generated recovery files into REPO_DIR. If a
    previous run fails after writing those files but before committing, the next
    `git pull --ff-only` can fail with "local changes would be overwritten".
    Resetting is allowed for the default dedicated clone only; custom repos must
    opt in explicitly to avoid deleting operator work.
    """
    status = run(["git", "status", "--porcelain"], cwd=REPO_DIR, check=False)
    if not status.strip():
        return
    allow_reset = REPO_DIR == DEFAULT_BACKUP_REPO_DIR or os.environ.get("DATASEED_ALLOW_BACKUP_REPO_RESET") == "1"
    if not allow_reset:
        raise RuntimeError(
            f"Backup repo {REPO_DIR} has local changes; set DATASEED_ALLOW_BACKUP_REPO_RESET=1 "
            "or clean it manually before running the backup."
        )
    run(["git", "reset", "--hard", "HEAD"], cwd=REPO_DIR)
    run(["git", "clean", "-fd"], cwd=REPO_DIR)


def ensure_repo() -> None:
    ensure_brokered_git_auth()
    REPO_DIR.parent.mkdir(parents=True, exist_ok=True)
    if (REPO_DIR / ".git").is_dir():
        clean_backup_repo_if_needed()
        run(["git", "remote", "set-url", "origin", REPO_URL], cwd=REPO_DIR)
        run(["git", "fetch", "origin", BRANCH], cwd=REPO_DIR)
        run(["git", "checkout", BRANCH], cwd=REPO_DIR)
        run(["git", "pull", "--ff-only", "origin", BRANCH], cwd=REPO_DIR)
    elif REPO_DIR.exists() and any(REPO_DIR.iterdir()):
        raise RuntimeError(f"{REPO_DIR} exists and is not an empty git repo; refusing to overwrite it")
    else:
        run(["git", "clone", "--branch", BRANCH, REPO_URL, str(REPO_DIR)])
    run(["git", "config", "user.name", "Demeter Backup Bot"], cwd=REPO_DIR)
    run(["git", "config", "user.email", "demeter@dataseed.local"], cwd=REPO_DIR)


def file_size_human(path: Path) -> str:
    try:
        size = path.stat().st_size
    except OSError:
        return "missing"
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def sha256_short(path: Path) -> str:
    try:
        h = __import__("hashlib").sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        return h.hexdigest()[:16]
    except OSError:
        return "missing"


def extract_yaml_scalar(path: Path, section: str, key: str) -> str:
    if not path.exists():
        return "missing"
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    in_section = False
    for line in lines:
        if not line.startswith(" ") and line.rstrip() == f"{section}:":
            in_section = True
            continue
        if in_section and line and not line.startswith(" "):
            break
        if in_section:
            m = re.match(rf"^\s{{2}}{re.escape(key)}:\s*(.*)$", line)
            if m:
                return m.group(1).strip() or "''"
    return "missing"


def extract_top_toolsets(path: Path) -> list[str]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    result: list[str] = []
    in_toolsets = False
    for line in lines:
        if line.rstrip() == "toolsets:":
            in_toolsets = True
            continue
        if in_toolsets and line and not line.startswith("-") and not line.startswith(" "):
            break
        if in_toolsets:
            m = re.match(r"^-\s+(.+)$", line)
            if m:
                result.append(m.group(1).strip())
    return result


def config_summary() -> str:
    cfg = HERMES_HOME / "config.yaml"
    toolsets = extract_top_toolsets(cfg)
    rows = [
        f"- Config path: `{cfg}` ({file_size_human(cfg)}, sha256 {sha256_short(cfg)})",
        f"- Model provider: `{extract_yaml_scalar(cfg, 'model', 'provider')}`",
        f"- Model default: `{extract_yaml_scalar(cfg, 'model', 'default')}`",
        f"- Agent max_turns: `{extract_yaml_scalar(cfg, 'agent', 'max_turns')}`",
        f"- Agent reasoning_effort: `{extract_yaml_scalar(cfg, 'agent', 'reasoning_effort')}`",
        f"- Display personality: `{extract_yaml_scalar(cfg, 'display', 'personality')}`",
        f"- Display show_reasoning: `{extract_yaml_scalar(cfg, 'display', 'show_reasoning')}`",
        f"- Terminal backend: `{extract_yaml_scalar(cfg, 'terminal', 'backend')}`",
        f"- Terminal cwd: `{extract_yaml_scalar(cfg, 'terminal', 'cwd')}`",
        f"- Top-level toolsets: `{', '.join(toolsets) if toolsets else 'none listed'}`",
    ]
    return "\n".join(rows)


def cron_summary() -> str:
    jobs_file = HERMES_HOME / "cron" / "jobs.json"
    if not jobs_file.exists():
        return "No cron jobs file found."
    try:
        data: Any = json.loads(jobs_file.read_text(encoding="utf-8"))
    except Exception as exc:
        return f"Could not parse cron jobs file: {exc}"
    jobs = data.get("jobs", data) if isinstance(data, dict) else data
    if not isinstance(jobs, list) or not jobs:
        return "No cron jobs configured."
    lines = [f"Total jobs: {len(jobs)}. Sensitive fields excluded: prompt, deliver, delivery targets.", ""]
    for job in jobs:
        if not isinstance(job, dict):
            continue
        schedule = job.get("schedule_display")
        raw_schedule = job.get("schedule")
        if not schedule and isinstance(raw_schedule, dict):
            schedule = raw_schedule.get("display") or raw_schedule.get("expr") or raw_schedule.get("value")
        skills = job.get("skills") or ([job.get("skill")] if job.get("skill") else [])
        model = job.get("model") or {}
        lines.extend([
            f"- `{job.get('id', 'unknown')}` [{'active' if job.get('enabled', True) else 'paused'}]",
            f"  - Nombre: {job.get('name', '(unnamed)')}",
            f"  - Schedule: {schedule or 'unknown'}",
            f"  - Next run UTC: {job.get('next_run_at', 'unknown')}",
            f"  - Last run UTC/status: {job.get('last_run_at', 'never')} / {job.get('last_status', 'unknown')}",
            f"  - Mode: {'no-agent' if job.get('no_agent') else 'agent'}",
        ])
        if job.get("script"):
            lines.append(f"  - Script: {job.get('script')}")
        if job.get("workdir"):
            lines.append(f"  - Workdir: {job.get('workdir')}")
        if skills:
            lines.append(f"  - Skills: {', '.join(str(s) for s in skills if s)}")
        if isinstance(model, dict) and (model.get("provider") or model.get("model")):
            lines.append(f"  - Model override: {model.get('provider', 'default')}/{model.get('model', 'default')}")
        toolsets = job.get("enabled_toolsets")
        if toolsets:
            lines.append(f"  - Enabled toolsets: {', '.join(toolsets)}")
    return "\n".join(lines)


def skills_summary() -> str:
    skills_root = HERMES_HOME / "skills"
    if not skills_root.exists():
        return "No skills directory found."
    entries: list[str] = []
    for skill_md in sorted(skills_root.glob("**/SKILL.md")):
        try:
            text = skill_md.read_text(encoding="utf-8", errors="ignore")[:2000]
        except OSError:
            continue
        name = skill_md.parent.name
        desc = ""
        m_name = re.search(r"^name:\s*['\"]?([^'\"\n]+)", text, flags=re.M)
        m_desc = re.search(r"^description:\s*['\"]?([^'\"\n]+)", text, flags=re.M)
        if m_name:
            name = m_name.group(1).strip()
        if m_desc:
            desc = m_desc.group(1).strip()
        rel = skill_md.parent.relative_to(skills_root)
        entries.append(f"- `{name}` ({rel})" + (f" — {desc}" if desc else ""))
    return "\n".join(entries) if entries else "No SKILL.md files found."


def key_files_summary() -> str:
    candidates = [
        HERMES_HOME / "config.yaml",
        HERMES_HOME / "memories" / "MEMORY.md",
        HERMES_HOME / "memories" / "USER.md",
        HERMES_HOME / "channel_directory.json",
        HERMES_HOME / "gateway_state.json",
        HERMES_HOME / "cron" / "jobs.json",
    ]
    lines = []
    for path in candidates:
        rel = path if not str(path).startswith(str(HERMES_HOME)) else path.relative_to(HERMES_HOME)
        lines.append(f"- `{rel}`: {file_size_human(path)}, sha256 {sha256_short(path)}")
    return "\n".join(lines)


def task_tracking_reference_summary() -> str:
    summary_path = TASK_TRACKING_REPO_DIR / DAILY_SUMMARY_REPO_REL
    task_log_path = TASK_TRACKING_REPO_DIR / TASK_LOG_REPO_REL
    completed_cycles_path = TASK_TRACKING_REPO_DIR / COMPLETED_CYCLES_REPO_REL
    rows = [
        "- El `task-log.md` es volátil: se actualiza durante el día y se limpia a las 05:00 AM America/Santiago.",
        "- El `daily-summary.md` conserva el resumen diario y debe consultarse para tareas diarias, pendientes y bloqueos.",
        "- El backup diario de las 05:00 AM NO copia `task-log.md` ni `daily-summary.md`; solo deja esta referencia para consultarlos en el repo de tracking.",
        "- Este backup sí copia `backups/COMPLETED_CYCLES.md`, que contiene únicamente ciclos grandes completados.",
        f"- Repo/branch de tracking: `{TASK_TRACKING_REPO_DIR}` / `{TASK_TRACKING_BRANCH}`.",
        f"- Daily summary: `{DAILY_SUMMARY_REPO_REL}` ({file_size_human(summary_path)}, sha256 {sha256_short(summary_path)}).",
        f"- Task log actual: `{TASK_LOG_REPO_REL}` ({file_size_human(task_log_path)}, sha256 {sha256_short(task_log_path)}).",
        f"- Ciclos grandes completados fuente: `{COMPLETED_CYCLES_REPO_REL}` ({file_size_human(completed_cycles_path)}, sha256 {sha256_short(completed_cycles_path)}).",
    ]
    return "\n".join(rows)


def default_completed_cycles_md() -> str:
    return """# Ciclos grandes completados — DataSeed / Demeter

Este archivo es curado manualmente por Demeter. Solo debe contener hitos/ciclos grandes ya cerrados y útiles para recuperación operativa.

Reglas:
- Incluir únicamente ciclos grandes completados.
- No incluir tareas diarias, pasos intermedios, pendientes, bloqueos ni detalles extensos.
- Para detalle diario, consultar `daily-summary.md` en el branch de tracking.
- Para detalle vivo del día, consultar `task-log.md` antes de su limpieza diaria.

## Ciclos registrados

- Aún no hay ciclos grandes completados registrados manualmente.
"""


def build_completed_cycles_md() -> str:
    if COMPLETED_CYCLES_SOURCE.exists() and COMPLETED_CYCLES_SOURCE.is_file():
        text = COMPLETED_CYCLES_SOURCE.read_text(encoding="utf-8", errors="ignore")
    else:
        text = default_completed_cycles_md()
    assert_no_secret_values(COMPLETED_CYCLES_REPO_REL, text)
    return sanitize_text(text)


def system_summary() -> str:
    lines = [
        f"- Host: `{platform.platform()}`",
        f"- Python: `{platform.python_version()}`",
        f"- Hermes home: `{HERMES_HOME}`",
        f"- Backup repo dir: `{REPO_DIR}`",
        f"- Backup branch: `{BRANCH}`",
    ]
    if HERMES_BIN.exists():
        lines.append(f"- Hermes binary: `{HERMES_BIN}`")
    df = run(["df", "-h", str(HERMES_HOME)], check=False)
    if df:
        lines.append("- Disk snapshot:")
        for ln in df.splitlines():
            lines.append(f"  `{ln}`")
    return "\n".join(lines)


def load_cron_jobs_from_disk() -> list[dict[str, Any]]:
    jobs_file = HERMES_HOME / "cron" / "jobs.json"
    if not jobs_file.exists():
        return []
    try:
        data: Any = json.loads(jobs_file.read_text(encoding="utf-8"))
    except Exception:
        return []
    jobs = data.get("jobs", data) if isinstance(data, dict) else data
    return [job for job in jobs if isinstance(job, dict)] if isinstance(jobs, list) else []


def resolve_cron_script_path(script_value: Any) -> Path | None:
    text = str(script_value or "").strip()
    if not text:
        return None
    raw = Path(text)
    source = raw.resolve() if raw.is_absolute() else (HERMES_HOME / "scripts" / raw).resolve()
    try:
        source.relative_to((HERMES_HOME / "scripts").resolve())
    except ValueError:
        # Avoid copying arbitrary absolute paths into the recovery repo.
        return None
    if source.suffix not in SAFE_CRON_SCRIPT_EXTENSIONS:
        return None
    return source


def repo_path_for_cron_script(source: Path) -> str:
    rel = source.relative_to((HERMES_HOME / "scripts").resolve())
    safe_parts: list[str] = []
    for part in rel.parts:
        if part in {"", ".", ".."} or "/" in part or "\\" in part:
            raise RuntimeError(f"Unsafe cron script path component: {part!r}")
        safe_parts.append(part)
    return str(Path("scripts", "cron", *safe_parts))


def copied_cron_scripts_summary() -> str:
    if not COPIED_CRON_SCRIPT_REPO_PATHS:
        return "- No hay scripts adicionales copiados como copia dura."
    return "\n".join(f"- `{rel}`" for rel in COPIED_CRON_SCRIPT_REPO_PATHS)


def cron_script_review_summary() -> str:
    if not CRON_SCRIPT_REVIEW_NOTES:
        return "- Sin scripts pendientes de revisión."
    return "\n".join(CRON_SCRIPT_REVIEW_NOTES)


def load_hardcopy_allowlist() -> set[str]:
    """Load explicit human approvals for hard-copying cron scripts.

    The file is intentionally local-only and not committed. One entry per line.
    Accepted forms: basename, path relative to /opt/data/scripts, absolute path,
    or destination repo path under scripts/cron/.
    """
    if not HARD_COPY_ALLOWLIST.exists():
        return set()
    entries: set[str] = set()
    for raw in HARD_COPY_ALLOWLIST.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        entries.add(line)
    return entries


def is_approved_for_hardcopy(source: Path, repo_rel: str, allowlist: set[str]) -> bool:
    try:
        rel_to_scripts = str(source.relative_to((HERMES_HOME / "scripts").resolve()))
    except ValueError:
        rel_to_scripts = source.name
    candidates = {source.name, rel_to_scripts, str(source), repo_rel}
    return bool(candidates & allowlist)


def copy_safe_cron_scripts() -> None:
    """Copy explicitly approved, non-sensitive cron scripts into scripts/cron/.

    If a script is not explicitly approved, it is documented as pending review
    and not committed. This enforces the rule: when in doubt, ask the operator
    before saving a hard copy in the backup branch.
    """
    COPIED_CRON_SCRIPT_REPO_PATHS.clear()
    CRON_SCRIPT_REVIEW_NOTES.clear()
    allowlist = load_hardcopy_allowlist()
    seen: set[Path] = set()
    for job in load_cron_jobs_from_disk():
        source = resolve_cron_script_path(job.get("script"))
        script_label = str(job.get("script") or "").strip()
        if source is None:
            if script_label:
                CRON_SCRIPT_REVIEW_NOTES.append(f"- `{script_label}`: no copiado; ruta fuera de `/opt/data/scripts` o extensión no permitida. Requiere revisión humana si debe guardarse.")
            continue
        if source in seen:
            continue
        seen.add(source)
        if source == SCRIPT_SOURCE:
            continue
        repo_rel = repo_path_for_cron_script(source)
        if not source.exists() or not source.is_file():
            CRON_SCRIPT_REVIEW_NOTES.append(f"- `{script_label}`: no copiado; archivo no encontrado en runtime.")
            continue
        if not is_approved_for_hardcopy(source, repo_rel, allowlist):
            CRON_SCRIPT_REVIEW_NOTES.append(f"- `{script_label}`: pendiente; existe pero NO se copia como copia dura sin aprobación explícita en `{HARD_COPY_ALLOWLIST}`.")
            continue
        text = source.read_text(encoding="utf-8", errors="ignore")
        try:
            assert_no_secret_values(f"cron script {script_label}", text)
        except RuntimeError as exc:
            CRON_SCRIPT_REVIEW_NOTES.append(f"- `{script_label}`: BLOQUEADO; patrón sensible detectado. {sanitize_text(str(exc))}")
            continue
        write_repo_file(repo_rel, text, executable=os.access(source, os.X_OK) or source.suffix in {".sh", ".bash"})
        if repo_rel not in COPIED_CRON_SCRIPT_REPO_PATHS:
            COPIED_CRON_SCRIPT_REPO_PATHS.append(repo_rel)


def backup_outputs_summary() -> str:
    outputs = [*ALLOWED_REPO_OUTPUTS, *COPIED_CRON_SCRIPT_REPO_PATHS]
    return "\n".join(f"- `{p}`" for p in outputs)


def build_backup_md() -> str:
    utc = now_utc()
    santiago = now_santiago()
    santiago_line = santiago.strftime("%Y-%m-%d %H:%M:%S %Z") if santiago else "not available"
    content = f"""# Backup operativo no sensible — DataSeed / Demeter

- Generado UTC: {utc.strftime('%Y-%m-%d %H:%M:%S %Z')}
- Generado America/Santiago: {santiago_line}
- Alcance: estado operativo no sensible para recuperación crítica.
- Política: no se respaldan credenciales, tokens, secretos OAuth, contraseñas, sesiones de mensajería, bases de datos runtime, logs completos, caches ni adjuntos. Scripts/documentos adicionales requieren aprobación explícita; ante duda se omiten.
- Rama objetivo: `{BRANCH}` en `{REPO_URL}`.

Los datos respaldados son semillas operativas: identidad, configuración resumida, cron jobs sanitizados, skills instalados, scripts seguros de restauración y ciclos grandes completados.

## Seguimiento de tareas y alcance del backup

{task_tracking_reference_summary()}

Regla operativa: el log diario registra detalles; el resumen diario consolida tareas y pendientes; el backup de las 05:00 AM solo guarda ciclos grandes completados y una referencia hacia el resumen diario.

## Identidad operativa

- Agente operativo: Demeter.
- Proyecto: DataSeed.
- Runtime técnico: Hermes Agent.
- Perfil activo esperado: `default`.
- Directorio persistente esperado: `/opt/data`.

## Estado técnico

{system_summary()}

## Configuración Hermes sanitizada

{config_summary()}

## Cron jobs configurados y estado

{cron_summary()}

## Skills instalados

{skills_summary()}

## Archivos operativos clave observados

No se copia el contenido de estos archivos; solo tamaño y huella para validación.

{key_files_summary()}

## Grafo de conocimiento del proyecto (Graphify)

El grafo de Graphify mapea las relaciones entre archivos, funciones y conceptos del proyecto.
Se genera con `scripts/generate-multibranch-graph.py`, que crea un snapshot temporal de todos los branches remotos, deduplica archivos idénticos bajo `_shared/` y copia al repo solo los artefactos livianos versionables.

- Directorio del grafo: `graphify-out/`
- Archivos incluidos en este backup: `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`
- Archivos grandes NO incluidos (regenerables): `graph.html`, `graph.json`, `cache/`, snapshots multibranch temporales
- Para regenerar: `cd /opt/data/data_seed && python3 scripts/generate-multibranch-graph.py`
- Reporte del grafo: `graphify-out/GRAPH_REPORT.md` (incluido en este backup)

## Archivos actualizados por este backup

{backup_outputs_summary()}

## Scripts de cron seguros incluidos

{copied_cron_scripts_summary()}

## Scripts/documentos pendientes de aprobación humana

{cron_script_review_summary()}

## Exclusiones estrictas

No se exportan ni se copian:

- `.env`, `.git-credentials`, `auth.json`, `google_token.json`, `google_client_secret.json`, `creds.json`.
- Sesiones de WhatsApp, Telegram, Discord u otras plataformas.
- `state.db`, bases de datos runtime, WAL/SHM, caches, adjuntos, audios, imágenes o documentos de usuario.
- Prompts completos de cron, destinos de entrega, chat identifiers, nombres de contactos o datos personales.
- Logs completos o dumps de conversaciones.
- `task-log.md` y `daily-summary.md`: no se copian al backup; se consultan en el branch de tracking (`feat/task-tracking-system`).

## Restauración

1. Consultar `backups/RESTORE_GUIDE.md`.
2. Ejecutar `backups/restore.sh` solo para verificación segura; no restaura secretos.
3. Reconfigurar credenciales y OAuth manualmente desde fuentes autorizadas.
4. Reconstituir cron jobs desde esta sección y desde instrucciones humanas autorizadas para prompts/destinos excluidos.
"""
    return sanitize_text(content)


def build_restore_guide() -> str:
    return sanitize_text("""# Guía de restauración crítica — DataSeed / Demeter

Esta guía permite reconstruir el estado operativo no sensible de Demeter después de un reinicio crítico o pérdida del contenedor.

## Principios

- El repositorio contiene únicamente material no sensible.
- Los secretos nunca se restauran desde GitHub.
- Las credenciales se reconfiguran manualmente desde fuentes autorizadas.
- Los prompts completos de cron y los destinos de entrega no se guardan en este backup.
- Los scripts/documentos adicionales solo se guardan como copia dura con aprobación explícita y escaneo básico de secretos. Si hay duda, no se copian; quedan listados como pendientes de revisión.
- `task-log.md` y `daily-summary.md` no se copian al backup diario; el backup solo referencia dónde consultarlos.
- Las tareas solo pasan al backup cuando son ciclos grandes completados y están registradas en `backups/COMPLETED_CYCLES.md`.

## Pasos de recuperación

1. Preparar el entorno persistente esperado:

```bash
mkdir -p /opt/data
cd /opt/data
```

2. Clonar el repositorio de recuperación:

```bash
git clone https://github.com/contacto101/data_seed.git /opt/data/data_seed
cd /opt/data/data_seed
```

3. Revisar el snapshot operativo:

```bash
less backups/BACKUP.md
```

4. Revisar ciclos grandes completados:

```bash
less backups/COMPLETED_CYCLES.md
```

5. Instalar o validar Hermes Agent según la documentación oficial.

6. Configurar secretos fuera del repositorio:

- GitHub token o credenciales git.
- OAuth de proveedores LLM.
- Credenciales de Google/Firebase si aplican.
- Tokens de APIs externas como ChileCompra o HubSpot.
- Sesiones de WhatsApp/gateway si se requiere continuidad de mensajería.

7. Validar configuración y gateway:

```bash
/opt/hermes/.venv/bin/hermes config check || true
/opt/hermes/.venv/bin/hermes doctor || true
/opt/hermes/.venv/bin/hermes cron list || true
```

8. Reconstituir cron jobs:

- Usar la sección de cron jobs de `backups/BACKUP.md` para nombres, horarios, scripts, skills y workdirs.
- Pedir al operador humano los prompts completos y destinos cuando estén excluidos.
- Mantener los backups y watchdogs como no-agent cuando sea posible para reducir riesgo de filtrar secretos.

9. Consultar seguimiento diario si hace falta:

- `daily-summary.md` en el branch `feat/task-tracking-system`: resumen diario, pendientes y bloqueos.
- `task-log.md` en el branch `feat/task-tracking-system`: detalle vivo del día antes de la limpieza diaria.

10. Ejecutar verificación segura:

```bash
bash backups/restore.sh
```

## Archivos seguros de este backup

- `backups/BACKUP.md`: snapshot operativo sanitizado.
- `backups/COMPLETED_CYCLES.md`: solo ciclos grandes completados; no contiene el log diario ni el resumen diario.
- `backups/RESTORE_GUIDE.md`: esta guía.
- `backups/restore.sh`: verificación segura post-restore.
- `scripts/ops/demeter_daily_backup.py`: rutina canónica que genera el backup diario.
- `scripts/ops/daily-operations.sh`: pipeline unificado grafo → resumen → reportes/correos → limpieza → backup.
- `scripts/ops/daily-operations-wrapper.sh`: wrapper horario America/Santiago para cron.
- `scripts/ops/daily-task-log-cleanup.sh`: limpieza de `task-log.md` y resumen diario, copia sanitizada aprobada.
- `scripts/ops/daily-area-reports.js`: clasificación por área, documentos Drive, correos e idempotencia.
- `backups/reporting/`: guía técnica, regla de salida y plantillas internas; Drive queda reservado para reportes.
- `scripts/demeter_daily_backup.py`, `scripts/daily-operations.sh`, `scripts/daily-operations-wrapper.sh`: wrappers temporales de compatibilidad para rutas antiguas.
- `scripts/cron/`: scripts referenciados por cron, solo si existen en `/opt/data/scripts`, tienen extensión segura (`.py`, `.sh`, `.bash`), pasan escaneo básico de secretos y fueron aprobados explícitamente en `/opt/data/backup_hardcopy_allowlist.txt`.

## Nunca commitear

- `.env`
- `.git-credentials`
- `auth.json`
- `google_token.json`
- `google_client_secret.json`
- `creds.json`
- `state.db` y derivados WAL/SHM
- sesiones de mensajería
- logs completos
- caches o adjuntos de usuario
- `task-log.md` y `daily-summary.md` dentro del backup diario
""")


def build_restore_sh() -> str:
    return sanitize_text(r"""#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[1/5] Repo"
git status --short || true

echo "[2/5] Checking that forbidden sensitive files are not tracked"
FORBIDDEN_REGEX='(^|/)(\.env|\.git-credentials|auth\.json|google_token\.json|google_client_secret\.json|creds\.json|state\.db|state\.db-wal|state\.db-shm|response_store\.db|response_store\.db-wal|response_store\.db-shm)($|/)'
if git ls-files | grep -E "$FORBIDDEN_REGEX" >/dev/null; then
  echo "ERROR: forbidden sensitive/runtime file tracked in repo"
  git ls-files | grep -E "$FORBIDDEN_REGEX"
  exit 1
fi

echo "[3/5] Hermes availability"
if [ -x /opt/hermes/.venv/bin/hermes ]; then
  /opt/hermes/.venv/bin/hermes --version || true
  /opt/hermes/.venv/bin/hermes config path || true
else
  echo "NOTE: /opt/hermes/.venv/bin/hermes not found. Install Hermes before full restore."
fi

echo "[4/5] Cron visibility"
if [ -x /opt/hermes/.venv/bin/hermes ]; then
  /opt/hermes/.venv/bin/hermes cron list || true
else
  echo "NOTE: cannot list cron jobs without Hermes."
fi

echo "[5/5] Backup files"
test -f backups/BACKUP.md && echo "OK backups/BACKUP.md"
test -f backups/COMPLETED_CYCLES.md && echo "OK backups/COMPLETED_CYCLES.md"
test -f backups/RESTORE_GUIDE.md && echo "OK backups/RESTORE_GUIDE.md"
test -f scripts/ops/demeter_daily_backup.py && echo "OK scripts/ops/demeter_daily_backup.py"
test -f scripts/demeter_daily_backup.py && echo "OK scripts/demeter_daily_backup.py compatibility wrapper"
test -f scripts/ops/daily-operations.sh && echo "OK scripts/ops/daily-operations.sh"
test -f scripts/ops/daily-operations-wrapper.sh && echo "OK scripts/ops/daily-operations-wrapper.sh"
test -f scripts/ops/daily-task-log-cleanup.sh && echo "OK scripts/ops/daily-task-log-cleanup.sh"
test -f scripts/ops/daily-area-reports.js && echo "OK scripts/ops/daily-area-reports.js"
if [ -d scripts/cron ]; then
  echo "Cron scripts copied for rollback:"
  find scripts/cron -type f | sort
fi

echo "Restore verification completed. Configure secrets manually; none are stored in this repo."
""")


def is_allowed_repo_output(rel: str) -> bool:
    rel_path = Path(rel)
    if rel in ALLOWED_REPO_OUTPUTS:
        return True
    if rel_path.is_absolute() or ".." in rel_path.parts:
        return False
    if not rel.startswith("scripts/cron/"):
        return False
    return rel_path.suffix in SAFE_CRON_SCRIPT_EXTENSIONS


def write_repo_file(rel: str, content: str, executable: bool = False) -> None:
    assert is_allowed_repo_output(rel), f"Refusing to write unexpected repo path: {rel}"
    assert_no_secret_values(rel, content)
    path = REPO_DIR / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if executable:
        try:
            path.chmod(0o755)
        except OSError:
            pass


def build_shell_compat_wrapper(target: str) -> str:
    return f"""#!/usr/bin/env bash
# Compatibilidad temporal: la implementación vive en {target}.
set -euo pipefail
ROOT=\"$(cd \"$(dirname \"${{BASH_SOURCE[0]}}\")/..\" && pwd)\"
exec \"$ROOT/{target}\" \"$@\"
"""


def build_python_compat_wrapper(target: str) -> str:
    return f'''#!/usr/bin/env python3
"""Compatibilidad temporal: la implementación vive en {target}."""
from __future__ import annotations

import os
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / "{target}"
os.execv("/usr/bin/env", ["/usr/bin/env", "python3", str(TARGET), *sys.argv[1:]])
'''


def copy_self_to_repo() -> None:
    text = SCRIPT_SOURCE.read_text(encoding="utf-8")
    assert_no_secret_values("scripts/ops/demeter_daily_backup.py", text)
    write_repo_file("scripts/ops/demeter_daily_backup.py", text, executable=True)
    write_repo_file(
        "scripts/demeter_daily_backup.py",
        build_python_compat_wrapper("scripts/ops/demeter_daily_backup.py"),
        executable=True,
    )


def update_repo_files() -> None:
    copy_safe_cron_scripts()
    write_repo_file(COMPLETED_CYCLES_REPO_REL, build_completed_cycles_md())
    write_repo_file("backups/BACKUP.md", build_backup_md())
    write_repo_file("backups/RESTORE_GUIDE.md", build_restore_guide())
    write_repo_file("backups/restore.sh", build_restore_sh(), executable=True)
    copy_self_to_repo()
    copy_graphify_outputs()
    copy_new_scripts()


def copy_graphify_outputs() -> None:
    """Copy non-sensitive graphify output files to the backup repo."""
    graphify_files = [
        ("graphify-out/GRAPH_REPORT.md", False),
        ("graphify-out/manifest.json", False),
        ("graphify-out/.graphify_labels.json", False),
    ]
    for rel, executable in graphify_files:
        source = GRAPHIFY_SOURCE_REPO_DIR / rel
        if not source.exists():
            continue
        text = source.read_text(encoding="utf-8", errors="ignore")
        assert_no_secret_values(rel, text)
        write_repo_file(rel, text, executable=executable)


def copy_new_scripts() -> None:
    """Copy canonical daily-operation scripts plus compatibility wrappers."""
    scripts = [
        ("daily-operations.sh", "scripts/ops/daily-operations.sh", True),
        ("daily-operations-wrapper.sh", "scripts/ops/daily-operations-wrapper.sh", True),
        ("daily-task-log-cleanup.sh", "scripts/ops/daily-task-log-cleanup.sh", True),
        ("github_api_commit.py", "scripts/ops/github_api_commit.py", True),
    ]
    for source_name, repo_rel, executable in scripts:
        repo_source = CANONICAL_REPO_DIR / repo_rel
        runtime_source = HERMES_HOME / "scripts" / source_name
        # Prefer runtime scripts: cron executes /opt/data/scripts, so these are the durable source of truth.
        source = runtime_source if runtime_source.exists() else repo_source
        if not source.exists():
            continue
        text = source.read_text(encoding="utf-8", errors="ignore")
        assert_no_secret_values(repo_rel, text)
        write_repo_file(repo_rel, text, executable=executable)

    runtime_generator = HERMES_HOME / "scripts" / "generate-multibranch-graph.py"
    repo_generator = CANONICAL_REPO_DIR / "scripts/generate-multibranch-graph.py"
    generator_source = runtime_generator if runtime_generator.exists() else repo_generator
    if generator_source.exists():
        text = generator_source.read_text(encoding="utf-8", errors="ignore")
        assert_no_secret_values("scripts/generate-multibranch-graph.py", text)
        write_repo_file("scripts/generate-multibranch-graph.py", text, executable=True)

    area_reporter_candidates = [
        HERMES_HOME / "automations" / "daily-area-reporting" / "daily-area-reports.js",
        CANONICAL_REPO_DIR / "scripts" / "ops" / "daily-area-reports.js",
    ]
    for source in area_reporter_candidates:
        if source.exists():
            text = source.read_text(encoding="utf-8", errors="ignore")
            assert_no_secret_values("scripts/ops/daily-area-reports.js", text)
            write_repo_file("scripts/ops/daily-area-reports.js", text, executable=True)
            break

    reporting_tests_root = HERMES_HOME / "automations" / "daily-area-reporting" / "tests"
    reporting_tests_prefix = Path("scripts/ops/tests/reporting")
    for repo_rel in REPORTING_TEST_OUTPUTS:
        relative = Path(repo_rel).relative_to(reporting_tests_prefix)
        source = reporting_tests_root / relative
        if not source.exists():
            raise RuntimeError(f"Required reporting test not found: {source}")
        text = source.read_text(encoding="utf-8", errors="strict")
        assert_no_secret_values(repo_rel, text)
        write_repo_file(repo_rel, text, executable=source.suffix in {".sh", ".py", ".js"})

    staging = HERMES_HOME / "dataseed-reportes-drive-staging"
    reporting_docs = [
        (
            HERMES_HOME / "automations" / "daily-area-reporting" / "README.md",
            "backups/reporting/AUTOMATIZACION_UNIFICADA_DE_REPORTES.md",
        ),
        (
            staging / "00_Estandar_y_Guia" / "README__SISTEMA_DE_REPORTES.md",
            "backups/reporting/README__SISTEMA_DE_REPORTES.md",
        ),
        (
            staging / "00_Estandar_y_Guia" / "PLANTILLA_BASE__REPORTE_DE_AREA__v1.md",
            "backups/reporting/PLANTILLA_BASE__REPORTE_DE_AREA__v1.md",
        ),
        (
            HERMES_HOME / "dataseed-reportes-drive-staging-docx" / "00_Estandar_y_Guia" / "REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md",
            "backups/reporting/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md",
        ),
    ]
    for source in sorted(staging.glob("*/PLANTILLA__*.md")):
        reporting_docs.append((source, f"backups/reporting/areas/{source.name}"))
    for source, repo_rel in reporting_docs:
        if not source.exists():
            continue
        text = source.read_text(encoding="utf-8", errors="ignore")
        assert_no_secret_values(repo_rel, text)
        write_repo_file(repo_rel, text, executable=False)

    write_repo_file(
        "scripts/daily-operations.sh",
        build_shell_compat_wrapper("scripts/ops/daily-operations.sh"),
        executable=True,
    )
    write_repo_file(
        "scripts/daily-operations-wrapper.sh",
        build_shell_compat_wrapper("scripts/ops/daily-operations-wrapper.sh"),
        executable=True,
    )
    write_repo_file(
        "scripts/github_api_commit.py",
        build_python_compat_wrapper("scripts/ops/github_api_commit.py"),
        executable=True,
    )


def commit_via_agent_vault_api(message: str, changed_paths: list[str]) -> str:
    if not GITHUB_API_HELPER.exists():
        raise RuntimeError(f"Agent Vault GitHub API helper not found: {GITHUB_API_HELPER}")
    return run(
        [
            "python3",
            str(GITHUB_API_HELPER),
            "--repo-dir",
            str(REPO_DIR),
            "--branch",
            BRANCH,
            "--message",
            message,
            *changed_paths,
        ],
        cwd=REPO_DIR,
    )


def commit_and_push() -> str:
    outputs = [*ALLOWED_REPO_OUTPUTS, *COPIED_CRON_SCRIPT_REPO_PATHS]
    run(["git", "add", *outputs], cwd=REPO_DIR)
    diff = run(["git", "diff", "--cached", "--name-only"], cwd=REPO_DIR, check=False)
    if not diff.strip():
        current = run(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_DIR)
        return f"Demeter Daily Backup OK: sin cambios; HEAD {current}"
    utc = now_utc().strftime("%Y-%m-%d %H:%M UTC")
    message = f"backup: estado operativo Demeter {utc}"
    changed_paths = diff.splitlines()
    api_result = commit_via_agent_vault_api(message, changed_paths)
    # Dedicated generated clone: align local state with the API-created commit so
    # the next cron run can pull/compare cleanly. This reset policy is limited to
    # the backup clone, not arbitrary operator repos.
    run(["git", "fetch", "origin", BRANCH], cwd=REPO_DIR, check=False)
    run(["git", "reset", "--hard", f"origin/{BRANCH}"], cwd=REPO_DIR, check=False)
    current = run(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_DIR, check=False) or "unknown"
    changed = ", ".join(diff.splitlines())
    return f"Demeter Daily Backup OK: {api_result}; local HEAD {current}; archivos: {changed}"


def main() -> int:
    try:
        ensure_repo()
        update_repo_files()
        print(commit_and_push())
        return 0
    except Exception as exc:
        print(f"Demeter Daily Backup ERROR: {sanitize_text(str(exc))}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
