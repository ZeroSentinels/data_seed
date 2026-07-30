#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
cp -a /opt/data/data_seed_daily_backup/backups/reporting "$TMP/templates"
cp /opt/data/dataseed-reportes-drive-staging-docx/00_Estandar_y_Guia/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md "$TMP/templates/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md"

DATASEED_TASK_TRACKING_REPO_DIR="$TMP" \
DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" \
DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" \
DATASEED_REPORT_STATE_ROOT="$TMP/state" \
/opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-01 >/dev/null

MANIFEST="$TMP/output/2099-01-01/manifest.json"
DOCX="$TMP/output/2099-01-01/2099-01-01__OPERACIONES__REPORTE__v1.docx"
node -e '
const m=require(process.argv[1]); const a=m.areas[0]; const t=a.template;
if (!t || !t.baseFile || !t.areaFile || !t.ruleFile) process.exit(1);
for (const key of ["baseSha256","areaSha256","ruleSha256"]) if (!/^[a-f0-9]{64}$/.test(t[key]||"")) process.exit(1);
' "$MANIFEST"
python3 -c 'import sys,zipfile; print(zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode())' "$DOCX" > "$TMP/document.xml"
for hash in $(node -e 'const t=require(process.argv[1]).areas[0].template; console.log(t.baseSha256,t.areaSha256,t.ruleSha256)' "$MANIFEST"); do
  grep -Fq "$hash" "$TMP/document.xml"
done
grep -Fq 'Cumplimiento de SLA operativo' "$TMP/document.xml"
for column in Resultado Meta Variación Tendencia Fuente Dueño; do grep -Fq "$column" "$TMP/document.xml"; done
grep -Fq 'No se registraron próximos compromisos obligatorios.' "$TMP/document.xml"
if grep -Fq 'Pendientes históricos pueden perder vigencia' "$TMP/document.xml"; then
  printf 'false_pending_detected\n' >&2
  exit 1
fi
grep -Fq '8. Decisiones requeridas' "$TMP/document.xml"
grep -Fq '9. Calidad de datos y fuentes' "$TMP/document.xml"
grep -Fq '10. Enlaces y fuentes' "$TMP/document.xml"
grep -Fq '11. Registro de cambios' "$TMP/document.xml"
printf 'template_usage_ok\n'
