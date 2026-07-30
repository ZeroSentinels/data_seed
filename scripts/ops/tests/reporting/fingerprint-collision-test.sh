#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
cat > "$TMP/task-log.md" <<'EOF'
# Task Log - Demeter

<!-- ENTRADAS -->

## 2099-01-01 10:00 - Procesar cierre operativo

**Estado:** ✅ Finalizada y verificada

**Solicitud:** Revisar el cierre del sistema A.

**Qué se hizo:** Se completó el cierre operativo.

**Verificación:** Evidencia independiente A.

**Pendiente:** Ninguno.

## 2099-01-01 11:00 - Procesar cierre operativo

**Estado:** ✅ Finalizada y verificada

**Solicitud:** Revisar el cierre del sistema B.

**Qué se hizo:** Se completó el cierre operativo.

**Verificación:** Evidencia independiente B.

**Pendiente:** Confirmar el sistema B mañana.
EOF
DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-13 >/dev/null
python3 - "$TMP/state/2099-01-13.json" <<'PY'
import json, sys
state = json.load(open(sys.argv[1], encoding='utf-8'))
fingerprints = state['taskFingerprints']
assert len(fingerprints) == 2, fingerprints
assert len(set(fingerprints)) == 2, fingerprints
assert len(state['taskSnapshot']) == 2, state['taskSnapshot']
PY
printf 'fingerprint_collision_ok\n'
