#!/usr/bin/env python3
"""Generate DataSeed's deduplicated multi-branch Graphify corpus.

The normal Graphify run sees only the checked-out tree. This script builds a
safe temporary corpus with every remote branch under a branch namespace, folds
identical files into `_shared/`, runs Graphify, and copies only the lightweight
versioned outputs back into `graphify-out/`.

It intentionally does not delete remote branches or change the repository tree
outside the generated graph outputs.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path, PurePosixPath

REPO = Path(os.environ.get("DATASEED_CANONICAL_REPO_DIR", str(Path(__file__).resolve().parents[1]))).resolve()
OUTPUT_DIR = REPO / "graphify-out"
GRAPHIFY_BIN = os.environ.get(
    "GRAPHIFY_BIN",
    "/opt/data/home/.local/share/uv/tools/graphifyy/bin/graphify",
)

# Runtime / secret / generated material that must never enter the graph corpus.
EXCLUDED_PARTS = {
    ".git",
    "graphify-out",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".cache",
    "cache",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
}
EXCLUDED_FILENAMES = {
    ".env",
    ".git-credentials",
    "auth.json",
    "google_token.json",
    "google_client_secret.json",
    "creds.json",
    "credentials.json",
    "token.json",
    "secrets.json",
    "secret.json",
    "service-account.json",
    "service_account.json",
    "state.db",
    "state.db-wal",
    "state.db-shm",
    "response_store.db",
    "response_store.db-wal",
    "response_store.db-shm",
}
EXCLUDED_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".mp4",
    ".mov",
    ".mp3",
    ".wav",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".pdf",
    ".doc",
    ".docx",
    ".pyc",
    ".pyo",
    ".so",
    ".dll",
    ".exe",
    ".sqlite",
    ".sqlite3",
    ".db",
    ".dump",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
}

# Known low-value residue from early WhatsApp/connectivity tests. These remain
# discoverable in Git history, but they should not dominate architecture graphs.
EXCLUDED_EXACT_PATHS = {
    "hola.txt",
    "hola_segundo.txt",
    "hola_tercer.txt",
    "hola_whatsapp.txt",
    "test_access.md",
    "archive/testing/hola.txt",
    "archive/testing/hola_segundo.txt",
    "archive/testing/hola_tercer.txt",
    "archive/testing/hola_whatsapp.txt",
    "archive/testing/test_access.md",
}

# These files describe global operational recovery state, not branch-specific
# product work. Older copies in feature branches create semantic duplicates in
# the multi-branch graph, so main is the only source of truth for them.
MAIN_ONLY_PREFIXES = (
    "backups/",
)
MAIN_ONLY_EXACT_PATHS = {
    "AGENTS.md",
    "README.md",
    "docs/INDEX.md",
    "docs/operations/branch-inventory.md",
    "docs/operations/graphify.md",
}

LIGHTWEIGHT_OUTPUTS = [
    "GRAPH_REPORT.md",
    "manifest.json",
    ".graphify_labels.json",
]
OPTIONAL_LOCAL_OUTPUTS = [
    "graph.html",
    "graph.json",
    "multibranch_manifest.json",
]


@dataclass
class BranchEntry:
    branch: str
    commit: str
    files_seen: int = 0
    files_included_unique: int = 0
    files_shared: int = 0
    files_excluded: int = 0


@dataclass
class FileEntry:
    branch: str
    path: str
    sha256: str
    size: int
    content: bytes


def run(cmd: list[str], *, cwd: Path = REPO, text: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=text, check=False)


def safe_member_name(name: str) -> bool:
    path = PurePosixPath(name)
    return not path.is_absolute() and ".." not in path.parts


def is_allowed_path(path: str) -> tuple[bool, str]:
    if not safe_member_name(path):
        return False, "unsafe path"
    pp = PurePosixPath(path)
    parts = set(pp.parts)
    name = pp.name
    suffix = pp.suffix.lower()
    if path in EXCLUDED_EXACT_PATHS:
        return False, "known test residue"
    if parts & EXCLUDED_PARTS:
        return False, "runtime/cache/generated path"
    if name in EXCLUDED_FILENAMES:
        return False, "secret/runtime filename"
    if suffix in EXCLUDED_SUFFIXES:
        return False, "binary/heavy suffix"
    if name.startswith(".env") and name not in {".env.example", ".env.sample", ".env.template"}:
        return False, "real env file"
    return True, "included"


def remote_branches() -> list[str]:
    result = run(["git", "for-each-ref", "refs/remotes/origin", "--format=%(refname:strip=3)"])
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return sorted(b for b in result.stdout.splitlines() if b and b != "HEAD")


def branch_commit(branch: str) -> str:
    result = run(["git", "rev-parse", f"origin/{branch}"])
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def files_from_branch(branch: str) -> list[tuple[str, bytes]]:
    """Return allowed files from a branch archive as (path, bytes)."""
    result = run(["git", "archive", "--format=tar", f"origin/{branch}"], text=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))

    out: list[tuple[str, bytes]] = []
    with tarfile.open(fileobj=io.BytesIO(result.stdout), mode="r:") as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            allowed, _reason = is_allowed_path(member.name)
            if not allowed:
                continue
            if branch != "main" and (
                member.name in MAIN_ONLY_EXACT_PATHS
                or any(member.name.startswith(prefix) for prefix in MAIN_ONLY_PREFIXES)
            ):
                continue
            extracted = archive.extractfile(member)
            if extracted is None:
                continue
            content = extracted.read()
            # Skip very large text-ish files to keep graph usable.
            if len(content) > 1_000_000:
                continue
            out.append((member.name, content))
    return out


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def make_branch_doc(entry: BranchEntry, unique_paths: list[str], shared_paths: list[tuple[str, str]]) -> str:
    lines = [
        f"# Branch `{entry.branch}`",
        "",
        f"- Commit: `{entry.commit}`",
        f"- Files seen: {entry.files_seen}",
        f"- Unique files included: {entry.files_included_unique}",
        f"- Files mapped to shared corpus: {entry.files_shared}",
        f"- Files excluded by safety/noise filters: {entry.files_excluded}",
        "",
        "## Unique files in this branch",
        "",
    ]
    lines.extend(f"- `{p}`" for p in sorted(unique_paths)[:300])
    if len(unique_paths) > 300:
        lines.append(f"- ... {len(unique_paths) - 300} more")
    lines += ["", "## Shared files reused by this branch", ""]
    lines.extend(f"- `{src}` → `{dest}`" for src, dest in sorted(shared_paths)[:300])
    if len(shared_paths) > 300:
        lines.append(f"- ... {len(shared_paths) - 300} more")
    lines.append("")
    return "\n".join(lines)


def canonical_path_score(path: str) -> tuple[int, str]:
    """Prefer current source-of-truth paths when folding duplicate content."""
    if path == "docs/product/design-system.md":
        return (-100, path)
    if path == "AGENTS.md":
        return (-90, path)
    if path.startswith("docs/"):
        return (-80, path)
    if path.startswith("scripts/ops/") or path.startswith("scripts/web/"):
        return (-70, path)
    if path.startswith("site/"):
        return (-60, path)
    if path == "design-system/MASTER.md":
        return (80, path)
    if path == "AGENT.md":
        return (70, path)
    if path.startswith("archive/"):
        return (60, path)
    return (0, path)


def build_snapshot() -> tuple[Path, dict]:
    snapshot = Path(tempfile.mkdtemp(prefix="dataseed-multibranch-snapshot-", dir="/tmp"))
    branches = remote_branches()

    entries: list[FileEntry] = []
    branch_entries: dict[str, BranchEntry] = {}

    for branch in branches:
        commit = branch_commit(branch)
        branch_entry = BranchEntry(branch=branch, commit=commit)
        raw_files = files_from_branch(branch)
        branch_entry.files_seen = len(raw_files)
        for rel, content in raw_files:
            digest = hashlib.sha256(content).hexdigest()
            entries.append(FileEntry(branch, rel, digest, len(content), content))
        branch_entries[branch] = branch_entry

    grouped: dict[str, list[FileEntry]] = defaultdict(list)
    for item in entries:
        grouped[item.sha256].append(item)

    shared_map: dict[tuple[str, str], str] = {}
    unique_paths: dict[str, list[str]] = defaultdict(list)
    shared_paths_by_branch: dict[str, list[tuple[str, str]]] = defaultdict(list)

    for digest, items in grouped.items():
        # Fold exact duplicates across branches into one shared file.
        if len(items) > 1:
            first = sorted(items, key=lambda x: (canonical_path_score(x.path), x.branch))[0]
            shared_rel = f"_shared/{first.path}"
            if Path(shared_rel).suffix == "":
                shared_rel = f"_shared/by-hash/{digest[:12]}.txt"
            write_bytes(snapshot / shared_rel, first.content)
            for item in items:
                shared_map[(item.branch, item.path)] = shared_rel
                shared_paths_by_branch[item.branch].append((item.path, shared_rel))
                branch_entries[item.branch].files_shared += 1
        else:
            item = items[0]
            dest = f"branches/{item.branch}/{item.path}"
            write_bytes(snapshot / dest, item.content)
            unique_paths[item.branch].append(item.path)
            branch_entries[item.branch].files_included_unique += 1

    # Reconstruct excluded counts using git ls-tree so the report includes filtered residue.
    for branch in branches:
        ls = run(["git", "ls-tree", "-r", "--name-only", f"origin/{branch}"])
        if ls.returncode == 0:
            total = len([x for x in ls.stdout.splitlines() if x.strip()])
            branch_entries[branch].files_excluded = max(0, total - branch_entries[branch].files_seen)

    for branch, entry in branch_entries.items():
        write_text(
            snapshot / "branches" / branch / "BRANCH.md",
            make_branch_doc(entry, unique_paths[branch], shared_paths_by_branch[branch]),
        )

    manifest = {
        "repo": "contacto101/data_seed",
        "mode": "deduplicated-multibranch",
        "branches": {branch: asdict(entry) for branch, entry in branch_entries.items()},
        "shared_file_count": len({v for v in shared_map.values()}),
        "shared_mappings_count": len(shared_map),
        "unique_file_count": sum(len(v) for v in unique_paths.values()),
        "excluded_exact_paths": sorted(EXCLUDED_EXACT_PATHS),
    }
    write_text(snapshot / "snapshot_manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
    write_text(
        snapshot / "README.md",
        "# DataSeed deduplicated multi-branch graph corpus\n\n"
        "Generated from all `origin/*` branches. Identical files are stored once under `_shared/`; "
        "branch-specific differences live under `branches/<branch>/`.\n\n"
        "This corpus is temporary and should not be committed wholesale. Commit only lightweight Graphify outputs.\n",
    )
    return snapshot, manifest


def run_graphify(snapshot: Path) -> None:
    result = run([GRAPHIFY_BIN, "update", ".", "--force"], cwd=snapshot)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"graphify failed with {result.returncode}")


def write_multibranch_manifest(snapshot: Path, manifest: dict[str, object]) -> Path:
    """Persist current corpus metadata together with Graphify metrics."""
    generated = snapshot / "graphify-out"
    graph_path = generated / "graph.json"
    if not graph_path.exists():
        raise RuntimeError("graphify-out/graph.json was not generated")
    graph_data = json.loads(graph_path.read_text(encoding="utf-8", errors="ignore"))
    nodes = graph_data.get("nodes", [])
    links = graph_data.get("links", [])
    enriched = dict(manifest)
    enriched.update(
        {
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S +0000", time.gmtime()),
            "nodes": len(nodes) if isinstance(nodes, list) else 0,
            "links": len(links) if isinstance(links, list) else 0,
            "communities": len(
                {
                    node.get("community")
                    for node in nodes
                    if isinstance(node, dict) and node.get("community") is not None
                }
            )
            if isinstance(nodes, list)
            else 0,
        }
    )
    output = generated / "multibranch_manifest.json"
    write_text(output, json.dumps(enriched, indent=2, ensure_ascii=False))
    return output


def copy_outputs(snapshot: Path) -> None:
    generated = snapshot / "graphify-out"
    if not generated.exists():
        raise RuntimeError("graphify-out was not generated")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in LIGHTWEIGHT_OUTPUTS + OPTIONAL_LOCAL_OUTPUTS:
        src = generated / name
        if src.exists():
            shutil.copy2(src, OUTPUT_DIR / name)


def main() -> int:
    snapshot, manifest = build_snapshot()
    print(f"Snapshot: {snapshot}")
    print(f"Branches: {len(manifest['branches'])}")
    print(f"Shared files: {manifest['shared_file_count']}")
    print(f"Shared mappings: {manifest['shared_mappings_count']}")
    print(f"Unique branch files: {manifest['unique_file_count']}")
    run_graphify(snapshot)
    write_multibranch_manifest(snapshot, manifest)
    copy_outputs(snapshot)
    print(f"Graph outputs copied to: {OUTPUT_DIR}")
    print("Snapshot manifest:")
    print(json.dumps(manifest, indent=2, ensure_ascii=False)[:4000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
