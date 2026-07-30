#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
cp -a /opt/data/data_seed_daily_backup/backups/reporting "$TMP/templates"

python3 -c 'from pathlib import Path; p=Path("'$TMP'/templates/PLANTILLA_BASE__REPORTE_DE_AREA__v1.md"); t=p.read_text(); p.write_text("# Base rota\n\n## 10. Enlaces y fuentes\n\n## 11. Registro de cambios\n")'
set +e
OUT="$(DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-04 2>&1)"
RC=$?
set -e
[ "$RC" -ne 0 ]
printf '%s' "$OUT" | grep -Fq 'Plantilla base incompleta'

cp /opt/data/data_seed_daily_backup/backups/reporting/PLANTILLA_BASE__REPORTE_DE_AREA__v1.md "$TMP/templates/PLANTILLA_BASE__REPORTE_DE_AREA__v1.md"
printf 'regla arbitraria\n' > "$TMP/templates/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md"
set +e
OUT="$(DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-05 2>&1)"
RC=$?
set -e
[ "$RC" -ne 0 ]
printf '%s' "$OUT" | grep -Fq 'Regla de salida invalida'

cat > "$TMP/templates/REGLA_DE_SALIDA__REPORTES_COMO_DOCUMENTOS.md" <<'EOF'
# Regla engañosa
## Formato obligatorio
Los reportes finales son documentos editables. No publicar reportes finales como archivos `.md`.
## Fuente obligatoria de estructura
Texto sin estructura.
## Estructura que debe conservarse
Texto sin la lista numerada 1-9.
EOF
set +e
OUT="$(DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_TEMPLATE_ROOT="$TMP/templates" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-10 2>&1)"
RC=$?
set -e
[ "$RC" -ne 0 ]
printf '%s' "$OUT" | grep -Fq 'Regla de salida invalida'
printf 'template_validation_ok\n'
