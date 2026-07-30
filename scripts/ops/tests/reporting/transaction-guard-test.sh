#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
mkdir -p "$TMP/state"
printf '{"status":"complete","reports":{},"emails":{}}\n' > "$TMP/state/2099-01-08.json"
set +e
OUT="$(DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-08 2>&1)"
RC=$?
set -e
[ "$RC" -ne 0 ]
printf '%s' "$OUT" | grep -Fq 'Estado completo sin manifiesto obligatorio'
python3 - <<'PY'
from pathlib import Path
s = Path('/opt/data/automations/daily-area-reporting/daily-area-reports.js').read_text()
manifest = s.index('saveJson(manifestPath, manifest)')
email = s.index('const subject = `Reportes diarios DataSeed')
processed = s.index('saveJson(processedPath,', email)
committing = s.index("state.status = 'committing'")
complete = s.index("state.status = 'complete'")
assert manifest < email < committing < processed < complete, (manifest, email, committing, processed, complete)
PY
printf 'transaction_guard_ok\n'
