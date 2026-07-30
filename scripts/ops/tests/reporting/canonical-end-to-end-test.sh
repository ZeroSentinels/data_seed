#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp /opt/data/automations/daily-area-reporting/tests/fixtures/task-log-template.md "$TMP/task-log.md"
cp /opt/data/automations/daily-area-reporting/tests/fixtures/daily-summary-empty.md "$TMP/daily-summary.md"
DATASEED_TASK_TRACKING_REPO_DIR="$TMP" DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" DATASEED_REPORT_STATE_ROOT="$TMP/state" /opt/data/automations/daily-area-reporting/daily-area-reports.js --dry-run --report-date 2099-01-11 >/dev/null
MANIFEST="$TMP/output/2099-01-11/manifest.json"
node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1])); if(m.version!=="1.3.0"||m.areas.length!==1) process.exit(1); const a=m.areas[0]; for(const k of ["baseSha256","areaSha256","ruleSha256"]) if(!/^[a-f0-9]{64}$/.test(a.template[k])) process.exit(1);' "$MANIFEST"
printf 'canonical_end_to_end_ok\n'
