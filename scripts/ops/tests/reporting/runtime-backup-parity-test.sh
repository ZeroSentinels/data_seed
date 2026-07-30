#!/usr/bin/env bash
set -euo pipefail
cmp -s /opt/data/automations/daily-area-reporting/daily-area-reports.js /opt/data/data_seed_daily_backup/scripts/ops/daily-area-reports.js
printf 'runtime_backup_parity_ok\n'
