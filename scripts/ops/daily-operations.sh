#!/usr/bin/env bash
# Operaciones diarias Demeter: grafo -> resumen -> reportes/correos -> limpieza -> backup.
# Salida WhatsApp: reporte ejecutivo compacto. Detalle técnico queda en log local.
# Runtime estable para cron: usa /opt/data/scripts como fuente de scripts, no el checkout vivo del repo.
set -euo pipefail

# Brokered GitHub access for non-interactive Hermes cron.
# Security invariant: this script must not read .env, export raw tokens, write
# ~/.git-credentials, or answer Git credential prompts. GitHub access must be
# provided by Agent Vault/proxy policy; otherwise the job fails closed.
disable_direct_git_credentials() {
  local count="${GIT_CONFIG_COUNT:-0}"
  case "$count" in
    ''|*[!0-9]*) count=0 ;;
  esac
  export "GIT_CONFIG_KEY_${count}=credential.helper"
  export "GIT_CONFIG_VALUE_${count}="
  export GIT_CONFIG_COUNT=$((count + 1))
}

setup_brokered_git_env() {
  export HOME="${HOME:-/opt/data/home}"
  mkdir -p "$HOME"
  unset GITHUB_TOKEN GH_TOKEN GITHUB_PAT
  export GIT_TERMINAL_PROMPT=0
  if [ -x /bin/false ]; then
    export GIT_ASKPASS=/bin/false
    export SSH_ASKPASS=/bin/false
  else
    unset GIT_ASKPASS SSH_ASKPASS
  fi
  disable_direct_git_credentials
}

normalize_agent_vault_git_env() {
  # Git/libcurl treats a proxy URL with only username as a prompt for password.
  # Agent Vault accepts an empty password, so add the ':' while preserving the proxy.
  if [ -n "${HTTPS_PROXY:-}" ] && [[ "$HTTPS_PROXY" == http://*@* ]] && [[ "$HTTPS_PROXY" != *://*:*@* ]]; then
    export HTTPS_PROXY="${HTTPS_PROXY/@/:@}"
  fi
  if [ -n "${HTTP_PROXY:-}" ] && [[ "$HTTP_PROXY" == http://*@* ]] && [[ "$HTTP_PROXY" != *://*:*@* ]]; then
    export HTTP_PROXY="${HTTP_PROXY/@/:@}"
  fi
  if [ -z "${GIT_SSL_CAINFO:-}" ]; then
    if [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ]; then
      export GIT_SSL_CAINFO="$SSL_CERT_FILE"
    elif [ -n "${REQUESTS_CA_BUNDLE:-}" ] && [ -f "$REQUESTS_CA_BUNDLE" ]; then
      export GIT_SSL_CAINFO="$REQUESTS_CA_BUNDLE"
    elif [ -f /opt/agent-vault-ca.pem ]; then
      export GIT_SSL_CAINFO=/opt/agent-vault-ca.pem
    elif [ -f /opt/data/agent-vault/agent-vault-ca.pem ]; then
      export GIT_SSL_CAINFO=/opt/data/agent-vault/agent-vault-ca.pem
    fi
  fi
}

ensure_git_identity() {
  if ! git config user.name >/dev/null 2>&1; then
    git config user.name "Demeter Ops Bot"
  fi
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "demeter@dataseed.local"
  fi
}

sanitize_stream() {
  sed -E \
    -e 's#https?://[^/@[:space:]]+(:[^/@[:space:]]*)?@#https://<redacted-userinfo>@#g' \
    -e 's#av_agt_[A-Za-z0-9_\-]{12,}#av_agt_<redacted>#g' \
    -e 's#github_pat_[A-Za-z0-9_]{20,}#github_pat_<redacted>#g' \
    -e 's#gh[pousr]_[A-Za-z0-9_]{20,}#gh_<redacted>#g' \
    -e 's#sk-[A-Za-z0-9_\-]{20,}#sk-<redacted>#g'
}

clip_text() {
  local max="${2:-220}"
  local text="${1//$'\n'/ }"
  text="$(printf '%s' "$text" | sanitize_stream)"
  if [ "${#text}" -gt "$max" ]; then
    printf '%s…' "${text:0:max}"
  else
    printf '%s' "$text"
  fi
}

setup_brokered_git_env
normalize_agent_vault_git_env

TIMESTAMP=$(TZ='America/Santiago' date '+%Y-%m-%d %H:%M:%S %Z')
DATE=$(TZ='America/Santiago' date '+%Y-%m-%d')
RUN_ID=$(TZ='America/Santiago' date '+%Y%m%d-%H%M%S')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL_REPO="${DATASEED_CANONICAL_REPO_DIR:-/opt/data/data_seed}"

if [ -n "${DATASEED_TASK_TRACKING_REPO_DIR:-}" ]; then
  TRACKING_REPO="$DATASEED_TASK_TRACKING_REPO_DIR"
elif [ -f "/opt/data/data_seed_tasklog_worktree/task-log.md" ]; then
  TRACKING_REPO="/opt/data/data_seed_tasklog_worktree"
elif [ -f "/tmp/data_seed_tasklog_worktree/task-log.md" ]; then
  TRACKING_REPO="/tmp/data_seed_tasklog_worktree"
else
  TRACKING_REPO="$CANONICAL_REPO"
fi

GRAPH_GENERATOR="${DATASEED_GRAPH_GENERATOR:-$SCRIPT_DIR/generate-multibranch-graph.py}"
TASK_CLEANUP="${DATASEED_TASK_CLEANUP_SCRIPT:-$SCRIPT_DIR/daily-task-log-cleanup.sh}"
AREA_REPORTER="${DATASEED_AREA_REPORTER:-/opt/data/automations/daily-area-reporting/daily-area-reports.js}"
BACKUP_SCRIPT="${DATASEED_DAILY_BACKUP_SCRIPT:-$SCRIPT_DIR/demeter_daily_backup.py}"
LOG_DIR="${DATASEED_DAILY_LOG_DIR:-/opt/data/logs/demeter-daily-operations}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-operations-$RUN_ID.log"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Fallbacks de recuperación si falta algún runtime script.
if [ ! -f "$GRAPH_GENERATOR" ] && [ -f "$CANONICAL_REPO/scripts/generate-multibranch-graph.py" ]; then
  GRAPH_GENERATOR="$CANONICAL_REPO/scripts/generate-multibranch-graph.py"
fi
if [ ! -f "$TASK_CLEANUP" ] && [ -f "$CANONICAL_REPO/scripts/ops/daily-task-log-cleanup.sh" ]; then
  TASK_CLEANUP="$CANONICAL_REPO/scripts/ops/daily-task-log-cleanup.sh"
fi
if [ ! -f "$AREA_REPORTER" ] && [ -f "$CANONICAL_REPO/scripts/ops/daily-area-reports.js" ]; then
  AREA_REPORTER="$CANONICAL_REPO/scripts/ops/daily-area-reports.js"
fi
if [ ! -f "$BACKUP_SCRIPT" ] && [ -f "$CANONICAL_REPO/scripts/ops/demeter_daily_backup.py" ]; then
  BACKUP_SCRIPT="$CANONICAL_REPO/scripts/ops/demeter_daily_backup.py"
fi

EXEC_STATUS="GREEN"
CRITICAL_FAILURE=0
declare -a STEP_KEYS=()
declare -a STEP_LABELS=()
declare -a STEP_STATUSES=()
declare -a STEP_RCS=()
declare -a STEP_DURATIONS=()
declare -a STEP_OUTPUTS=()

log_line() {
  printf '[%s] %s\n' "$(TZ='America/Santiago' date '+%Y-%m-%d %H:%M:%S %Z')" "$*" >> "$LOG_FILE"
}

run_step() {
  local key="$1"
  local label="$2"
  local critical="$3"
  shift 3
  local out="$TMP_DIR/$key.out"
  local start end duration rc
  start=$(date +%s)
  log_line "=== $label ==="
  set +e
  "$@" >"$out" 2>&1
  rc=$?
  set -e
  end=$(date +%s)
  duration=$((end - start))
  {
    printf '\n--- %s (rc=%s, duration=%ss) ---\n' "$label" "$rc" "$duration"
    sanitize_stream < "$out"
  } >> "$LOG_FILE"

  STEP_KEYS+=("$key")
  STEP_LABELS+=("$label")
  STEP_RCS+=("$rc")
  STEP_DURATIONS+=("$duration")
  STEP_OUTPUTS+=("$out")

  if [ "$rc" -eq 0 ]; then
    if grep -Eai 'ERROR|WARNING|WARN|fatal:|abort|Traceback|HUMAN_REQUIRED' "$out" >/dev/null 2>&1; then
      STEP_STATUSES+=("⚠️ REVISAR")
      if [ "$EXEC_STATUS" != "RED" ]; then
        EXEC_STATUS="YELLOW"
      fi
    else
      STEP_STATUSES+=("✅ OK")
    fi
  elif [ "$critical" = "1" ]; then
    STEP_STATUSES+=("❌ FALLÓ")
    EXEC_STATUS="RED"
    CRITICAL_FAILURE=1
  else
    STEP_STATUSES+=("⚠️ REVISAR")
    if [ "$EXEC_STATUS" != "RED" ]; then
      EXEC_STATUS="YELLOW"
    fi
  fi
}

first_alert_line() {
  local file="$1"
  grep -Eai 'ERROR|WARNING|WARN|fatal:|abort|Traceback|HUMAN_REQUIRED' "$file" \
    | sanitize_stream \
    | head -n 1 || true
}

extract_alerts() {
  local max_lines="${1:-6}"
  local count=0
  local idx key label status line clipped
  for idx in "${!STEP_KEYS[@]}"; do
    key="${STEP_KEYS[$idx]}"
    label="${STEP_LABELS[$idx]}"
    status="${STEP_STATUSES[$idx]}"
    [[ "$status" == *OK* ]] && continue
    case "$key" in
      graph)
        printf -- '- %s: no se pudieron actualizar refs remotos o regenerar Graphify completamente; no bloquea el backup. Ver log técnico.\n' "$label"
        ;;
      summary)
        line="$(first_alert_line "${STEP_OUTPUTS[$idx]}")"
        clipped="$(clip_text "${line:-sin detalle de error en stdout}" 180)"
        printf -- '- %s: no se pudo consolidar el resumen; task-log preservado. Primer indicio: %s\n' "$label" "$clipped"
        ;;
      reports)
        line="$(first_alert_line "${STEP_OUTPUTS[$idx]}")"
        clipped="$(clip_text "${line:-sin detalle de error en stdout}" 180)"
        printf -- '- %s: no se completaron clasificación, Drive o correos; task-log preservado. Primer indicio: %s\n' "$label" "$clipped"
        ;;
      cleanup)
        line="$(first_alert_line "${STEP_OUTPUTS[$idx]}")"
        clipped="$(clip_text "${line:-sin detalle de error en stdout}" 180)"
        printf -- '- %s: no se pudo limpiar el task-log después de distribuir reportes. Primer indicio: %s\n' "$label" "$clipped"
        ;;
      backup)
        line="$(first_alert_line "${STEP_OUTPUTS[$idx]}")"
        clipped="$(clip_text "${line:-sin detalle de error en stdout}" 180)"
        printf -- '- %s: backup operativo requiere revisión. Primer indicio: %s\n' "$label" "$clipped"
        ;;
      *)
        line="$(first_alert_line "${STEP_OUTPUTS[$idx]}")"
        clipped="$(clip_text "${line:-sin detalle de error en stdout}" 180)"
        printf -- '- %s: revisar. Primer indicio: %s\n' "$label" "$clipped"
        ;;
    esac
    count=$((count + 1))
    if [ "$count" -ge "$max_lines" ]; then
      return 0
    fi
  done
}

extract_task_metrics() {
  local summary="$TRACKING_REPO/daily-summary.md"
  if [ ! -f "$summary" ]; then
    printf 'daily-summary.md no disponible'
    return 0
  fi
  python3 - "$summary" "$DATE" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
date = sys.argv[2]
text = path.read_text(encoding='utf-8', errors='ignore')
pattern = re.compile(rf'^## Resumen\s+{re.escape(date)}\b.*?(?=^## Resumen\s+|\Z)', re.M | re.S)
blocks = pattern.findall(text)
if not blocks:
    print('sin entradas nuevas para resumir')
    raise SystemExit
block = blocks[-1]
def row_count(label_regex: str) -> int:
    m = re.search(rf'^\|\s*{label_regex}[^|]*\|\s*(\d+)\s*\|', block, re.M)
    return int(m.group(1)) if m else 0
success = row_count('✅')
errors = row_count('❌')
active = row_count('🔄')
pending = row_count('⏳')
print(f'{success} finalizadas, {errors} con error, {active} activas, {pending} en espera')
PY
}

extract_task_attention() {
  local summary="$TRACKING_REPO/daily-summary.md"
  if [ ! -f "$summary" ]; then
    return 0
  fi
  python3 - "$summary" "$DATE" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
date = sys.argv[2]
text = path.read_text(encoding='utf-8', errors='ignore')
pattern = re.compile(rf'^## Resumen\s+{re.escape(date)}\b.*?(?=^## Resumen\s+|\Z)', re.M | re.S)
blocks = pattern.findall(text)
if not blocks:
    raise SystemExit
block = blocks[-1]
def row_count(label_regex: str) -> int:
    m = re.search(rf'^\|\s*{label_regex}[^|]*\|\s*(\d+)\s*\|', block, re.M)
    return int(m.group(1)) if m else 0
errors = row_count('❌')
active = row_count('🔄')
pending = row_count('⏳')
items = []
if errors:
    items.append(f'{errors} tarea(s) cerraron con error')
if active:
    items.append(f'{active} tarea(s) siguen activas')
if pending:
    items.append(f'{pending} tarea(s) quedan en espera de acción humana')
if items:
    print('; '.join(items))
PY
}

extract_graph_note() {
  python3 - "$CANONICAL_REPO" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
candidates = [
    root / 'graphify-out' / 'multibranch_manifest.json',
    root / 'graphify-out' / 'manifest.json',
]
for path in candidates:
    if not path.exists():
        continue
    try:
        data = json.loads(path.read_text(encoding='utf-8', errors='ignore'))
    except Exception:
        continue
    branches = data.get('branches') or data.get('included_branches') or data.get('refs') or []
    branch_count = len(branches) if isinstance(branches, list) else data.get('branch_count')
    nodes = data.get('nodes') or data.get('node_count') or data.get('total_nodes')
    links = data.get('links') or data.get('edge_count') or data.get('total_links')
    pieces = []
    if branch_count:
        pieces.append(f'{branch_count} branches')
    if isinstance(nodes, int):
        pieces.append(f'{nodes} nodos')
    if isinstance(links, int):
        pieces.append(f'{links} enlaces')
    print(', '.join(pieces) if pieces else 'artefactos Graphify verificados')
    break
else:
    print('sin métricas de grafo disponibles')
PY
}

extract_backup_note() {
  local file="$1"
  if [ -f "$file" ]; then
    local line
    line="$(grep -Eai 'Demeter Daily Backup (OK|ERROR)' "$file" | tail -n 1 | sanitize_stream || true)"
    if [ -n "$line" ]; then
      clip_text "$line" 260
      return 0
    fi
  fi
  printf 'backup ejecutado; ver log técnico'
}

step_note() {
  local key="$1"
  local status="$2"
  local out="$3"
  local line
  case "$key" in
    graph)
      if [[ "$status" == *OK* ]]; then
        printf 'actualizado/validado (%s)' "$(extract_graph_note)"
      else
        printf 'no bloqueante; requiere revisión técnica'
      fi
      ;;
    summary)
      if [[ "$status" == *OK* ]]; then
        printf 'resumen consolidado sin limpiar task-log: %s' "$(extract_task_metrics)"
      else
        printf 'falló el resumen; task-log preservado'
      fi
      ;;
    reports)
      if [[ "$status" == *OK* ]]; then
        line="$(grep -E '^(VERDE|DRY-RUN VERDE|PRUEBA VERDE)' "$out" | tail -n 1 || true)"
        if [ -n "$line" ]; then
          printf '%s' "$line"
        else
          printf 'sin tareas terminales nuevas; no se generaron documentos ni correos'
        fi
      else
        printf 'falló la publicación o comunicación; task-log preservado'
      fi
      ;;
    cleanup)
      if [[ "$status" == *OK* ]]; then
        printf 'task-log limpiado después de reportes y correos'
      else
        printf 'falló la limpieza posterior; backup omitido'
      fi
      ;;
    backup)
      if [[ "$status" == *OK* ]]; then
        extract_backup_note "$out"
      else
        printf 'falló el backup operativo; revisar log técnico'
      fi
      ;;
    *)
      printf 'ver log técnico'
      ;;
  esac
}

print_report() {
  local title state_line attention task_attention alerts idx note
  case "$EXEC_STATUS" in
    GREEN) state_line="✅ VERDE — operación diaria completada y sin bloqueos detectados" ;;
    YELLOW) state_line="⚠️ AMARILLO — operación completada con advertencias no bloqueantes" ;;
    RED) state_line="❌ ROJO — operación diaria incompleta; requiere revisión" ;;
    *) state_line="⚠️ Estado desconocido" ;;
  esac

  printf 'REPORTE EJECUTIVO DEMETER — %s\n' "$DATE"
  printf 'Hora Chile: %s\n' "$TIMESTAMP"
  printf 'Estado general: %s\n\n' "$state_line"

  printf 'Resumen ejecutivo:\n'
  for idx in "${!STEP_KEYS[@]}"; do
    note="$(step_note "${STEP_KEYS[$idx]}" "${STEP_STATUSES[$idx]}" "${STEP_OUTPUTS[$idx]}")"
    printf '%s. %s: %s — %s (%ss)\n' \
      "$((idx + 1))" \
      "${STEP_LABELS[$idx]}" \
      "${STEP_STATUSES[$idx]}" \
      "$(clip_text "$note" 280)" \
      "${STEP_DURATIONS[$idx]}"
  done

  printf '\nAtención requerida:\n'
  attention=""
  task_attention="$(extract_task_attention || true)"
  if [ -n "$task_attention" ]; then
    attention="- Tareas: $task_attention"
  fi
  alerts="$(extract_alerts 6 || true)"
  if [ -n "$alerts" ]; then
    if [ -n "$attention" ]; then
      attention="$attention"$'\n'"$alerts"
    else
      attention="$alerts"
    fi
  fi
  if [ -n "$attention" ]; then
    printf '%s\n' "$attention"
  else
    printf -- '- Sin acciones humanas requeridas.\n'
  fi

  printf '\nDetalle técnico local: %s\n' "$LOG_FILE"
}

log_line "Iniciando operaciones diarias unificadas."
log_line "Repo canónico: $CANONICAL_REPO"
log_line "Repo tracking: $TRACKING_REPO"
log_line "Graph generator: $GRAPH_GENERATOR"
log_line "Cleanup script: $TASK_CLEANUP"
log_line "Area reporter: $AREA_REPORTER"
log_line "Backup script: $BACKUP_SCRIPT"

run_step "graph" "Grafo de conocimiento" 0 bash -c '
  set -uo pipefail
  canonical_repo="$1"
  graph_generator="$2"
  if [ -d "$canonical_repo/.git" ] && [ -f "$graph_generator" ]; then
    fetch_rc=0
    git -C "$canonical_repo" fetch origin --prune || fetch_rc=$?
    if [ "$fetch_rc" -ne 0 ]; then
      echo "WARNING: No se pudo actualizar refs remotos antes de Graphify. Continuando con refs locales..."
    fi
    DATASEED_CANONICAL_REPO_DIR="$canonical_repo" python3 "$graph_generator"
  else
    echo "WARNING: No se pudo actualizar Graphify; falta repo o generador."
    exit 2
  fi
' _ "$CANONICAL_REPO" "$GRAPH_GENERATOR"

if [ ! -f "$TASK_CLEANUP" ]; then
  printf 'ERROR: no existe TASK_CLEANUP=%s\n' "$TASK_CLEANUP" > "$TMP_DIR/summary.out"
  STEP_KEYS+=("summary")
  STEP_LABELS+=("Resumen diario")
  STEP_STATUSES+=("❌ FALLÓ")
  STEP_RCS+=("1")
  STEP_DURATIONS+=("0")
  STEP_OUTPUTS+=("$TMP_DIR/summary.out")
  EXEC_STATUS="RED"
  CRITICAL_FAILURE=1
else
  run_step "summary" "Resumen diario" 1 env REPO_DIR="$TRACKING_REPO" DATASEED_TASK_TRACKING_REPO_DIR="$TRACKING_REPO" bash "$TASK_CLEANUP" --summary-only
fi

if [ "$CRITICAL_FAILURE" -ne 0 ]; then
  print_report
  exit 1
fi

if [ ! -f "$AREA_REPORTER" ]; then
  printf 'ERROR: no existe AREA_REPORTER=%s\n' "$AREA_REPORTER" > "$TMP_DIR/reports.out"
  STEP_KEYS+=("reports")
  STEP_LABELS+=("Áreas, reportes Drive y correos")
  STEP_STATUSES+=("❌ FALLÓ")
  STEP_RCS+=("1")
  STEP_DURATIONS+=("0")
  STEP_OUTPUTS+=("$TMP_DIR/reports.out")
  EXEC_STATUS="RED"
  CRITICAL_FAILURE=1
else
  run_step "reports" "Áreas, reportes Drive y correos" 1 /usr/local/bin/node "$AREA_REPORTER"
fi

if [ "$CRITICAL_FAILURE" -ne 0 ]; then
  print_report
  exit 1
fi

run_step "cleanup" "Limpieza del task-log" 1 env REPO_DIR="$TRACKING_REPO" DATASEED_TASK_TRACKING_REPO_DIR="$TRACKING_REPO" bash "$TASK_CLEANUP" --cleanup-only

if [ "$CRITICAL_FAILURE" -ne 0 ]; then
  print_report
  exit 1
fi

if [ ! -f "$BACKUP_SCRIPT" ]; then
  printf 'ERROR: no existe BACKUP_SCRIPT=%s\n' "$BACKUP_SCRIPT" > "$TMP_DIR/backup.out"
  STEP_KEYS+=("backup")
  STEP_LABELS+=("Backup operativo")
  STEP_STATUSES+=("❌ FALLÓ")
  STEP_RCS+=("1")
  STEP_DURATIONS+=("0")
  STEP_OUTPUTS+=("$TMP_DIR/backup.out")
  EXEC_STATUS="RED"
  CRITICAL_FAILURE=1
else
  run_step "backup" "Backup operativo" 1 bash -c '
    set -uo pipefail
    tracking_repo="$1"
    canonical_repo="$2"
    backup_script="$3"
    cd /opt/data
    DATASEED_TASK_TRACKING_REPO_DIR="$tracking_repo" \
      DATASEED_CANONICAL_REPO_DIR="$canonical_repo" \
      DATASEED_GRAPHIFY_SOURCE_REPO_DIR="$canonical_repo" \
      python3 "$backup_script"
  ' _ "$TRACKING_REPO" "$CANONICAL_REPO" "$BACKUP_SCRIPT"
fi

print_report
if [ "$CRITICAL_FAILURE" -ne 0 ]; then
  exit 1
fi
exit 0
