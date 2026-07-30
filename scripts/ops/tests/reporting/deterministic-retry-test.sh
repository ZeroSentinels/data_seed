#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
cp -a /opt/data/data_seed_daily_backup/backups/reporting "$TMP/templates"
cp /opt/data/dataseed-reportes-drive-staging-docx/00_Estandar_y_Guia/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md "$TMP/templates/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md"
run_report() {
  DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-09 >/dev/null
}
run_report
DOCX="$TMP/output/2099-01-09/2099-01-09__OPERACIONES__REPORTE__v1.docx"
FIRST="$(sha256sum "$DOCX" | cut -d' ' -f1)"
sleep 2
run_report
SECOND="$(sha256sum "$DOCX" | cut -d' ' -f1)"
[ "$FIRST" = "$SECOND" ]
printf 'deterministic_retry_ok sha256=%s\n' "$FIRST"
