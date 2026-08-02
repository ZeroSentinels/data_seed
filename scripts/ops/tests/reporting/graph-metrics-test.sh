#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_OPS_DIR="$(cd "$TEST_DIR/../.." && pwd)"
if [ -f "$LOCAL_OPS_DIR/daily-operations.sh" ]; then
  DAILY_OPERATIONS="$LOCAL_OPS_DIR/daily-operations.sh"
else
  DAILY_OPERATIONS="/opt/data/scripts/daily-operations.sh"
fi
TMP="$(mktemp -d -t graph-metrics-test-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/tracking" "$TMP/canonical" "$TMP/logs"
cp "$TEST_DIR/fixtures/task-log-template.md" "$TMP/tracking/task-log.md"
cp "$TEST_DIR/fixtures/daily-summary-empty.md" "$TMP/tracking/daily-summary.md"

git -C "$TMP/tracking" init -q
git -C "$TMP/tracking" config user.name 'Graph Metrics Test'
git -C "$TMP/tracking" config user.email 'graph-metrics@dataseed.local'
git -C "$TMP/tracking" add task-log.md daily-summary.md
git -C "$TMP/tracking" commit -qm 'fixture'

git -C "$TMP/canonical" init -q
git -C "$TMP/canonical" config user.name 'Graph Metrics Test'
git -C "$TMP/canonical" config user.email 'graph-metrics@dataseed.local'
git -C "$TMP/canonical" commit --allow-empty -qm 'fixture'
git -C "$TMP/canonical" remote add origin "$TMP/canonical"
cp "$TEST_DIR/fake-reporter.js" "$TMP/fake-reporter.cjs"

set +e
DATASEED_TASK_TRACKING_REPO_DIR="$TMP/tracking" \
DATASEED_CANONICAL_REPO_DIR="$TMP/canonical" \
DATASEED_GRAPH_GENERATOR="$TEST_DIR/fake-graph.py" \
DATASEED_AREA_REPORTER="$TMP/fake-reporter.cjs" \
DATASEED_DAILY_BACKUP_SCRIPT="$TEST_DIR/fake-backup.py" \
DATASEED_CLEANUP_PUSH=0 \
DATASEED_DAILY_LOG_DIR="$TMP/logs" \
bash "$DAILY_OPERATIONS" > "$TMP/result.txt"
RC=$?
set -e
if [ "$RC" -ne 0 ]; then
  printf 'daily operations fixture failed rc=%s\n' "$RC" >&2
  cat "$TMP/result.txt" >&2
  for log in "$TMP"/logs/*.log; do
    [ -f "$log" ] && cat "$log" >&2
  done
  exit "$RC"
fi

EXPECTED='actualizado/validado (3 branches, 7 nodos, 9 enlaces)'
if ! grep -Fq "$EXPECTED" "$TMP/result.txt"; then
  printf 'expected current graph metrics not found: %s\n' "$EXPECTED" >&2
  printf '%s\n' '--- output ---' >&2
  cat "$TMP/result.txt" >&2
  exit 1
fi

printf 'graph_metrics_ok=%s\n' "$EXPECTED"
