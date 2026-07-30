#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"

expect_reject() {
  local expected="$1"; shift
  set +e
  local out
  out="$(DATASEED_TASK_TRACKING_REPO_DIR="$TMP" "$@" 2>&1)"
  local rc=$?
  set -e
  [ "$rc" -ne 0 ]
  printf '%s' "$out" | grep -Fq -- "$expected"
}

expect_reject 'solo se permite con --dry-run' env DATASEED_REPORT_TEMPLATE_ROOT="$TMP" /opt/data/automations/daily-area-reporting/daily-area-reports.js --report-date 2099-01-06
expect_reject '--test requiere --dry-run' /opt/data/automations/daily-area-reporting/daily-area-reports.js --test --report-date 2099-01-06
expect_reject 'Destinatario no autorizado' /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --recipients atacante@example.com --report-date 2099-01-06
expect_reject '--recipients requiere al menos un destinatario' /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --recipients ',' --report-date 2099-01-06
printf 'production_guards_ok\n'
