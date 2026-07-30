#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
cp -a /opt/data/data_seed_daily_backup/backups/reporting "$TMP/templates"
run_report() {
  DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-12
}
run_report >/dev/null
DOCX="$TMP/output/2099-01-12/2099-01-12__OPERACIONES__REPORTE__v1.docx"
FIRST="$(sha256sum "$DOCX" | cut -d' ' -f1)"
python3 - "$TMP/state/2099-01-12.json" "$TMP/state/processed-task-fingerprints.json" <<'PY'
import json, sys
from pathlib import Path
state_path, processed_path = map(Path, sys.argv[1:])
state = json.loads(state_path.read_text())
assert state.get('taskSnapshot'), state
assert state.get('templateSnapshots'), state
state['status'] = 'committing'
state_path.write_text(json.dumps(state, indent=2) + '\n')
Path(processed_path).write_text(json.dumps({'fingerprints': state['taskFingerprints']}, indent=2) + '\n')
PY
printf '# Task Log - Demeter\n<!-- ENTRADAS -->\n' > "$TMP/task-log.md"
printf '# Regla inválida después del primer intento\n' > "$TMP/templates/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md"
OUT="$(run_report)"
printf '%s' "$OUT" | grep -Fq 'DRY-RUN VERDE'
SECOND="$(sha256sum "$DOCX" | cut -d' ' -f1)"
[ "$FIRST" = "$SECOND" ]
printf 'snapshot_retry_ok sha256=%s\n' "$FIRST"
