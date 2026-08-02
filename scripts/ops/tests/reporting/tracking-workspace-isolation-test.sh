#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_OPS_DIR="$(cd "$TEST_DIR/../.." && pwd)"
if [ -f "$LOCAL_OPS_DIR/daily-operations.sh" ]; then
  DAILY_OPERATIONS="$LOCAL_OPS_DIR/daily-operations.sh"
else
  DAILY_OPERATIONS="/opt/data/scripts/daily-operations.sh"
fi
TMP="$(mktemp -d -t tracking-isolation-test-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/shared" "$TMP/canonical" "$TMP/logs"
cp "$TEST_DIR/fixtures/task-log-template.md" "$TMP/shared/task-log.md"
cp "$TEST_DIR/fixtures/daily-summary-empty.md" "$TMP/shared/daily-summary.md"
git -C "$TMP/shared" init -q
git -C "$TMP/shared" config user.name 'Tracking Isolation Test'
git -C "$TMP/shared" config user.email 'tracking-isolation@dataseed.local'
git -C "$TMP/shared" add task-log.md daily-summary.md
git -C "$TMP/shared" commit -qm 'fixture'
printf 'unrelated interactive change\n' > "$TMP/shared/unrelated.txt"
BEFORE="$(sha256sum "$TMP/shared/task-log.md" | cut -d' ' -f1)"

git -C "$TMP/canonical" init -q
git -C "$TMP/canonical" config user.name 'Tracking Isolation Test'
git -C "$TMP/canonical" config user.email 'tracking-isolation@dataseed.local'
git -C "$TMP/canonical" commit --allow-empty -qm 'fixture'
git -C "$TMP/canonical" remote add origin "$TMP/canonical"

cat > "$TMP/fake-helper.py" <<'PY'
#!/usr/bin/env python3
import json
import shutil
import sys
from pathlib import Path
args = sys.argv[1:]
def value(flag):
    return args[args.index(flag) + 1]
source = Path(value('--repo-dir'))
out = Path(value('--materialize-dir'))
out.mkdir(parents=True, exist_ok=True)
for name in ('task-log.md', 'daily-summary.md'):
    shutil.copy2(source / name, out / name)
(out / '.dataseed-remote-files.json').write_text(json.dumps({'repository':'contacto101/data_seed','branch':'feat/task-tracking-system','files':{'task-log.md':'snapshot','daily-summary.md':'summary'}}), encoding='utf-8')
print('github_api_commit OK: materialized 2 files')
PY
chmod +x "$TMP/fake-helper.py"

cat > "$TMP/fake-reporter.cjs" <<'JS'
const fs = require('fs');
const tracking = process.env.DATASEED_TASK_TRACKING_REPO_DIR || '';
fs.writeFileSync(process.env.TRACKING_PATH_OUT, tracking);
if (!tracking || !fs.existsSync(`${tracking}/task-log.md`)) process.exit(2);
console.log('VERDE — reporter usó workspace aislado.');
JS

set +e
TRACKING_PATH_OUT="$TMP/reporter-path.txt" \
DATASEED_TASK_TRACKING_REPO_DIR="$TMP/shared" \
DATASEED_TRACKING_ISOLATION=1 \
DATASEED_TRACKING_REPOSITORY='contacto101/data_seed' \
DATASEED_GITHUB_API_COMMIT_HELPER="$TMP/fake-helper.py" \
DATASEED_CANONICAL_REPO_DIR="$TMP/canonical" \
DATASEED_GRAPH_GENERATOR="$TEST_DIR/fake-graph.py" \
DATASEED_AREA_REPORTER="$TMP/fake-reporter.cjs" \
DATASEED_DAILY_BACKUP_SCRIPT="$TEST_DIR/fake-backup.py" \
DATASEED_CLEANUP_PUSH=0 \
DATASEED_DAILY_LOG_DIR="$TMP/logs" \
bash "$DAILY_OPERATIONS" > "$TMP/output.txt"
RC=$?
set -e
if [ "$RC" -ne 0 ]; then
  cat "$TMP/output.txt" >&2
  for log in "$TMP"/logs/*.log; do [ -f "$log" ] && cat "$log" >&2; done
  exit "$RC"
fi

AFTER="$(sha256sum "$TMP/shared/task-log.md" | cut -d' ' -f1)"
REPORTER_PATH="$(cat "$TMP/reporter-path.txt")"
[ "$BEFORE" = "$AFTER" ] || { echo 'shared task-log was modified' >&2; exit 1; }
[ "$REPORTER_PATH" != "$TMP/shared" ] || { echo 'reporter used shared worktree' >&2; exit 1; }
[[ "$REPORTER_PATH" == /tmp/* ]] || { echo "unexpected isolated path: $REPORTER_PATH" >&2; exit 1; }
[ -f "$TMP/shared/unrelated.txt" ] || { echo 'unrelated interactive file was removed' >&2; exit 1; }
printf 'tracking_workspace_isolation_ok=%s\n' "$REPORTER_PATH"
