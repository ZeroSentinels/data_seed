#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d -t bullet-field-parser-test-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/tracking" "$TMP/output" "$TMP/state"
cp "$TEST_DIR/fixtures/bullet-task-summary.md" "$TMP/tracking/daily-summary.md"
cp "$TEST_DIR/fixtures/daily-summary-empty.md" "$TMP/tracking/task-log.md"

DATASEED_TASK_TRACKING_REPO_DIR="$TMP/tracking" \
DATASEED_REPORT_OUTPUT_ROOT="$TMP/output" \
DATASEED_REPORT_STATE_ROOT="$TMP/state" \
/opt/data/automations/daily-area-reporting/daily-area-reports.js \
  --dry-run --report-date 2026-08-02 > "$TMP/output.txt"

MANIFEST="$TMP/output/2026-08-02/manifest.json"
[ -f "$MANIFEST" ]
node -e '
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (manifest.taskCount !== 1) throw new Error(`taskCount=${manifest.taskCount}`);
const names = manifest.areas.map(a => a.display).join(",");
if (!names) throw new Error("sin área clasificada");
const state = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const pending = state.taskSnapshot?.[0]?.pending;
if (pending !== "Validar técnicamente el repositorio cuando exista acceso.") {
  throw new Error(`pendiente no preservado limpiamente: ${pending}`);
}
' "$MANIFEST" "$TMP/state/2026-08-02.json"

grep -Fq 'MCP Mercado Público' "$TEST_DIR/fixtures/bullet-task-summary.md"

mkdir -p "$TMP/cleanup-tracking"
cp "$TEST_DIR/fixtures/bullet-task-log.md" "$TMP/cleanup-tracking/task-log.md"
cp "$TEST_DIR/fixtures/daily-summary-empty.md" "$TMP/cleanup-tracking/daily-summary.md"
git -C "$TMP/cleanup-tracking" init -q
git -C "$TMP/cleanup-tracking" config user.name 'Bullet Parser Test'
git -C "$TMP/cleanup-tracking" config user.email 'bullet-parser@dataseed.local'
git -C "$TMP/cleanup-tracking" add task-log.md daily-summary.md
git -C "$TMP/cleanup-tracking" commit -qm fixture
REPO_DIR="$TMP/cleanup-tracking" DATASEED_CLEANUP_PUSH=0 \
  /opt/data/scripts/daily-task-log-cleanup.sh --summary-only > "$TMP/cleanup-output.txt"
grep -Fq '| ✅ Finalizada exitosamente | 1 |' "$TMP/cleanup-tracking/daily-summary.md"

printf 'bullet_field_parser_ok=true\n'
