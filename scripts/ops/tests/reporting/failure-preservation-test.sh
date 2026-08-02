#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/tracking" "$TMP/canonical" "$TMP/logs"
cp "$TEST_DIR/fixtures/task-log-template.md" "$TMP/tracking/task-log.md"
cp "$TEST_DIR/fixtures/daily-summary-empty.md" "$TMP/tracking/daily-summary.md"
git -C "$TMP/tracking" init -q
git -C "$TMP/tracking" config user.name 'Integration Test'
git -C "$TMP/tracking" config user.email 'integration@dataseed.local'
git -C "$TMP/tracking" add task-log.md daily-summary.md
git -C "$TMP/tracking" commit -qm 'fixture'
git -C "$TMP/canonical" init -q

set +e
DATASEED_TASK_TRACKING_REPO_DIR="$TMP/tracking" \
DATASEED_CANONICAL_REPO_DIR="$TMP/canonical" \
DATASEED_GRAPH_GENERATOR="/opt/data/automations/daily-area-reporting/tests/fake-graph.py" \
DATASEED_AREA_REPORTER="/opt/data/automations/daily-area-reporting/tests/fake-reporter.js" \
DATASEED_DAILY_BACKUP_SCRIPT="/opt/data/automations/daily-area-reporting/tests/fake-backup.py" \
DATASEED_CLEANUP_PUSH=0 \
DATASEED_DAILY_LOG_DIR="$TMP/logs" \
FAIL_REPORTER=1 \
bash /opt/data/scripts/daily-operations.sh > "$TMP/result.txt"
RC=$?
set -e

[ "$RC" -ne 0 ]
grep -Eq '^## ' "$TMP/tracking/task-log.md"
grep -Fq 'task-log preservado' "$TMP/result.txt"
if grep -Fq 'Backup operativo:' "$TMP/result.txt"; then
  printf 'backup_should_not_run_after_report_failure\n' >&2
  exit 1
fi
printf 'failure_preserves_tasklog_ok rc=%s\n' "$RC"
