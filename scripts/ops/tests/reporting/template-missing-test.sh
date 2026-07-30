#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/templates"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"

set +e
OUTPUT="$(DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-02 2>&1)"
RC=$?
set -e
[ "$RC" -ne 0 ]
printf '%s' "$OUTPUT" | grep -Fq 'Plantilla obligatoria no encontrada'
[ ! -e "$TMP/output/2099-01-02/manifest.json" ]
printf 'missing_template_fails_closed_ok\n'
