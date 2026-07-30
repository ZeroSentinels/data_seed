#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[1/5] Repo"
git status --short || true

echo "[2/5] Checking that forbidden sensitive files are not tracked"
FORBIDDEN_REGEX='(^|/)(\.env|\.git-credentials|auth\.json|google_token\.json|google_client_secret\.json|creds\.json|state\.db|state\.db-wal|state\.db-shm|response_store\.db|response_store\.db-wal|response_store\.db-shm)($|/)'
if git ls-files | grep -E "$FORBIDDEN_REGEX" >/dev/null; then
  echo "ERROR: forbidden sensitive/runtime file tracked in repo"
  git ls-files | grep -E "$FORBIDDEN_REGEX"
  exit 1
fi

echo "[3/5] Hermes availability"
if [ -x /opt/hermes/.venv/bin/hermes ]; then
  /opt/hermes/.venv/bin/hermes --version || true
  /opt/hermes/.venv/bin/hermes config path || true
else
  echo "NOTE: /opt/hermes/.venv/bin/hermes not found. Install Hermes before full restore."
fi

echo "[4/5] Cron visibility"
if [ -x /opt/hermes/.venv/bin/hermes ]; then
  /opt/hermes/.venv/bin/hermes cron list || true
else
  echo "NOTE: cannot list cron jobs without Hermes."
fi

echo "[5/5] Backup files"
test -f backups/BACKUP.md && echo "OK backups/BACKUP.md"
test -f backups/COMPLETED_CYCLES.md && echo "OK backups/COMPLETED_CYCLES.md"
test -f backups/RESTORE_GUIDE.md && echo "OK backups/RESTORE_GUIDE.md"
test -f scripts/ops/demeter_daily_backup.py && echo "OK scripts/ops/demeter_daily_backup.py"
test -f scripts/demeter_daily_backup.py && echo "OK scripts/demeter_daily_backup.py compatibility wrapper"
test -f scripts/ops/daily-operations.sh && echo "OK scripts/ops/daily-operations.sh"
test -f scripts/ops/daily-operations-wrapper.sh && echo "OK scripts/ops/daily-operations-wrapper.sh"
test -f scripts/ops/daily-task-log-cleanup.sh && echo "OK scripts/ops/daily-task-log-cleanup.sh"
test -f scripts/ops/daily-area-reports.js && echo "OK scripts/ops/daily-area-reports.js"
if [ -d scripts/cron ]; then
  echo "Cron scripts copied for rollback:"
  find scripts/cron -type f | sort
fi

echo "Restore verification completed. Configure secrets manually; none are stored in this repo."
