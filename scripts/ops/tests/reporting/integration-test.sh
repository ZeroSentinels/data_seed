#!/usr/bin/env bash
set -euo pipefail

bash -n /opt/data/scripts/daily-operations.sh
bash -n /opt/data/scripts/daily-task-log-cleanup.sh
node --check /opt/data/automations/daily-area-reporting/daily-area-reports.js
node --check /opt/data/automations/daily-area-reporting/tests/fake-reporter.js

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/tracking" "$TMP/canonical" "$TMP/logs"
cp /opt/data/data_seed_tasklog_worktree/task-log.md "$TMP/tracking/task-log.md"
cp /opt/data/data_seed_tasklog_worktree/daily-summary.md "$TMP/tracking/daily-summary.md"

git -C "$TMP/tracking" init -q
git -C "$TMP/tracking" config user.name 'Integration Test'
git -C "$TMP/tracking" config user.email 'integration@dataseed.local'
git -C "$TMP/tracking" add task-log.md daily-summary.md
git -C "$TMP/tracking" commit -qm 'fixture'

git -C "$TMP/canonical" init -q
git -C "$TMP/canonical" config user.name 'Integration Test'
git -C "$TMP/canonical" config user.email 'integration@dataseed.local'

DATASEED_TASK_TRACKING_REPO_DIR="$TMP/tracking" \
DATASEED_CANONICAL_REPO_DIR="$TMP/canonical" \
DATASEED_GRAPH_GENERATOR="/opt/data/automations/daily-area-reporting/tests/fake-graph.py" \
DATASEED_AREA_REPORTER="/opt/data/automations/daily-area-reporting/tests/fake-reporter.js" \
DATASEED_DAILY_BACKUP_SCRIPT="/opt/data/automations/daily-area-reporting/tests/fake-backup.py" \
DATASEED_CLEANUP_PUSH=0 \
DATASEED_DAILY_LOG_DIR="$TMP/logs" \
bash /opt/data/scripts/daily-operations.sh > "$TMP/result.txt"

TODAY="$(TZ=America/Santiago date +%Y-%m-%d)"
grep -Fq "## Resumen $TODAY" "$TMP/tracking/daily-summary.md"
if grep -Eq '^## ' "$TMP/tracking/task-log.md"; then
  printf 'tasklog_not_cleaned\n' >&2
  exit 1
fi

STEP1="$(grep -nF '1. Grafo de conocimiento:' "$TMP/result.txt" | cut -d: -f1)"
STEP2="$(grep -nF '2. Resumen diario:' "$TMP/result.txt" | cut -d: -f1)"
STEP3="$(grep -nF '3. Áreas, reportes Drive y correos:' "$TMP/result.txt" | cut -d: -f1)"
STEP4="$(grep -nF '4. Limpieza del task-log:' "$TMP/result.txt" | cut -d: -f1)"
STEP5="$(grep -nF '5. Backup operativo:' "$TMP/result.txt" | cut -d: -f1)"
[ "$STEP1" -lt "$STEP2" ]
[ "$STEP2" -lt "$STEP3" ]
[ "$STEP3" -lt "$STEP4" ]
[ "$STEP4" -lt "$STEP5" ]

printf 'integration_order_ok=%s<%s<%s<%s<%s\n' "$STEP1" "$STEP2" "$STEP3" "$STEP4" "$STEP5"
printf '%s\n' '--- executive output ---'
printf '%s\n' "$(<"$TMP/result.txt")"
