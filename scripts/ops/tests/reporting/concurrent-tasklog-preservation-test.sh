#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_OPS_DIR="$(cd "$TEST_DIR/../.." && pwd)"
if [ -f "$LOCAL_OPS_DIR/daily-task-log-cleanup.sh" ]; then
  TASK_CLEANUP="$LOCAL_OPS_DIR/daily-task-log-cleanup.sh"
else
  TASK_CLEANUP="/opt/data/scripts/daily-task-log-cleanup.sh"
fi
TMP="$(mktemp -d -t concurrent-tasklog-test-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/repo/.git"
git -C "$TMP/repo" init -q
git -C "$TMP/repo" config user.name 'Concurrent Tasklog Test'
git -C "$TMP/repo" config user.email 'concurrent-test@dataseed.local'
cp "$TEST_DIR/fixtures/task-log-template.md" "$TMP/repo/task-log.md"
cp "$TEST_DIR/fixtures/daily-summary-empty.md" "$TMP/repo/daily-summary.md"
printf '%s\n' '{"repository":"contacto101/data_seed","branch":"feat/task-tracking-system","files":{"task-log.md":"snapshot-sha","daily-summary.md":"summary-sha"}}' > "$TMP/repo/.dataseed-remote-files.json"
git -C "$TMP/repo" add task-log.md daily-summary.md
git -C "$TMP/repo" commit -qm 'fixture'

cat > "$TMP/fake-helper.py" <<'PY'
#!/usr/bin/env python3
import os
import sys
from pathlib import Path
Path(os.environ['ARGS_OUT']).write_text('\n'.join(sys.argv[1:]), encoding='utf-8')
print('github_api_commit DEFERRED: concurrent remote update preserved for task-log.md', file=sys.stderr)
raise SystemExit(3)
PY
chmod +x "$TMP/fake-helper.py"

set +e
ARGS_OUT="$TMP/args.txt" \
REPO_DIR="$TMP/repo" \
DATASEED_CLEANUP_PUSH=1 \
DATASEED_GITHUB_API_COMMIT_HELPER="$TMP/fake-helper.py" \
bash "$TASK_CLEANUP" --cleanup-only > "$TMP/output.txt" 2>&1
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  printf 'cleanup should defer safely, got rc=%s\n' "$RC" >&2
  cat "$TMP/output.txt" >&2
  exit 1
fi
grep -Fq -- '--expect-remote-state' "$TMP/args.txt"
grep -Fq -- '--expect-path' "$TMP/args.txt"
grep -Fq 'task-log.md' "$TMP/args.txt"
grep -Fq 'WARNING: actualización concurrente preservada; limpieza diferida' "$TMP/output.txt"
printf 'concurrent_tasklog_preservation_ok=true\n'
