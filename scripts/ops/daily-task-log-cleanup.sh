#!/usr/bin/env bash
# Limpieza diaria de task-log.md y generación de daily-summary.md.
# Runtime estable para cron: NO delega al repo vivo, para que los cambios del repo no rompan el cron.
set -euo pipefail

# Brokered GitHub access for non-interactive Hermes cron.
# Security invariant: this script must not read .env, export raw tokens, write
# ~/.git-credentials, or answer Git credential prompts. GitHub access must be
# provided by Agent Vault/proxy policy; otherwise the job fails closed.
disable_direct_git_credentials() {
  local count="${GIT_CONFIG_COUNT:-0}"
  case "$count" in
    ''|*[!0-9]*) count=0 ;;
  esac
  export "GIT_CONFIG_KEY_${count}=credential.helper"
  export "GIT_CONFIG_VALUE_${count}="
  export GIT_CONFIG_COUNT=$((count + 1))
}

setup_brokered_git_env() {
  export HOME="${HOME:-/opt/data/home}"
  mkdir -p "$HOME"
  unset GITHUB_TOKEN GH_TOKEN GITHUB_PAT
  export GIT_TERMINAL_PROMPT=0
  if [ -x /bin/false ]; then
    export GIT_ASKPASS=/bin/false
    export SSH_ASKPASS=/bin/false
  else
    unset GIT_ASKPASS SSH_ASKPASS
  fi
  disable_direct_git_credentials
}

normalize_agent_vault_git_env() {
  # Git/libcurl treats a proxy URL with only username as a prompt for password.
  # Agent Vault accepts an empty password, so add the ':' while preserving the proxy.
  if [ -n "${HTTPS_PROXY:-}" ] && [[ "$HTTPS_PROXY" == http://*@* ]] && [[ "$HTTPS_PROXY" != *://*:*@* ]]; then
    export HTTPS_PROXY="${HTTPS_PROXY/@/:@}"
  fi
  if [ -n "${HTTP_PROXY:-}" ] && [[ "$HTTP_PROXY" == http://*@* ]] && [[ "$HTTP_PROXY" != *://*:*@* ]]; then
    export HTTP_PROXY="${HTTP_PROXY/@/:@}"
  fi
  if [ -z "${GIT_SSL_CAINFO:-}" ]; then
    if [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ]; then
      export GIT_SSL_CAINFO="$SSL_CERT_FILE"
    elif [ -n "${REQUESTS_CA_BUNDLE:-}" ] && [ -f "$REQUESTS_CA_BUNDLE" ]; then
      export GIT_SSL_CAINFO="$REQUESTS_CA_BUNDLE"
    elif [ -f /opt/agent-vault-ca.pem ]; then
      export GIT_SSL_CAINFO=/opt/agent-vault-ca.pem
    elif [ -f /opt/data/agent-vault/agent-vault-ca.pem ]; then
      export GIT_SSL_CAINFO=/opt/data/agent-vault/agent-vault-ca.pem
    fi
  fi
}

ensure_git_identity() {
  if ! git config user.name >/dev/null 2>&1; then
    git config user.name "Demeter Ops Bot"
  fi
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "demeter@dataseed.local"
  fi
}

setup_brokered_git_env
normalize_agent_vault_git_env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

push_tracking_branch() {
  local message="$1"
  local helper="${DATASEED_GITHUB_API_COMMIT_HELPER:-$SCRIPT_DIR/github_api_commit.py}"
  local -a precondition_args=()
  if [ "${DATASEED_GIT_PUSH_MODE:-api}" = "git" ]; then
    git push origin feat/task-tracking-system
    return
  fi
  if [ ! -f "$helper" ]; then
    echo "[$TIMESTAMP] ERROR: no existe helper GitHub API: $helper"
    return 1
  fi
  if { [ "$MODE" = "--cleanup-only" ] || [ "$MODE" = "--all" ]; } && [ -f "$REPO_DIR/.dataseed-remote-files.json" ]; then
    precondition_args=(
      --expect-remote-state "$REPO_DIR/.dataseed-remote-files.json"
      --expect-path task-log.md
    )
  fi
  python3 "$helper" \
    --repo-dir "$REPO_DIR" \
    --branch feat/task-tracking-system \
    --message "$message" \
    "${precondition_args[@]}" \
    task-log.md daily-summary.md
}

if [ -n "${REPO_DIR:-}" ]; then
  REPO_DIR="$REPO_DIR"
elif [ -n "${DATASEED_TASK_TRACKING_REPO_DIR:-}" ]; then
  REPO_DIR="$DATASEED_TASK_TRACKING_REPO_DIR"
elif [ -f "/opt/data/data_seed_tasklog_worktree/task-log.md" ]; then
  REPO_DIR="/opt/data/data_seed_tasklog_worktree"
elif [ -f "/tmp/data_seed_tasklog_worktree/task-log.md" ]; then
  REPO_DIR="/tmp/data_seed_tasklog_worktree"
else
  REPO_DIR="/opt/data/data_seed"
fi
TASK_LOG="$REPO_DIR/task-log.md"
DAILY_SUMMARY="$REPO_DIR/daily-summary.md"
DATE=$(TZ='America/Santiago' date '+%Y-%m-%d')
TIMESTAMP=$(TZ='America/Santiago' date '+%Y-%m-%d %H:%M:%S %Z')
PUSH_ENABLED="${DATASEED_CLEANUP_PUSH:-1}"
MODE="${1:---all}"

case "$MODE" in
  --all|--summary-only|--cleanup-only) ;;
  *)
    echo "[$TIMESTAMP] ERROR: modo inválido: $MODE (use --all, --summary-only o --cleanup-only)"
    exit 2
    ;;
esac

if [ ! -f "$TASK_LOG" ]; then
  echo "[$TIMESTAMP] ERROR: no existe task-log.md en $REPO_DIR"
  exit 1
fi
if [ ! -f "$DAILY_SUMMARY" ]; then
  touch "$DAILY_SUMMARY"
fi

if ! grep -q "<!-- ENTRADAS -->" "$TASK_LOG"; then
  echo "[$TIMESTAMP] WARNING: task-log.md sin marcador de entradas. Reparando (header + marcador antepuestos, contenido preservado)."
  TASK_LOG_TMP="$TASK_LOG.repair.$$"
  {
    echo "# Task Log - Demeter"
    echo ""
    echo "> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago)."
    echo "> No editar manualmente fuera del flujo automático."
    echo ""
    echo "---"
    echo ""
    echo "<!-- ENTRADAS -->"
    echo ""
    echo "> Reparado automáticamente por el pipeline: faltaba el marcador de entradas."
    echo ""
    cat "$TASK_LOG"
  } > "$TASK_LOG_TMP"
  mv "$TASK_LOG_TMP" "$TASK_LOG"
fi

ENTRIES=$(sed -n '/<!-- ENTRADAS -->/,$p' "$TASK_LOG" | tail -n +3)
if [ -z "$(printf '%s' "$ENTRIES" | tr -d '[:space:]')" ]; then
  echo "[$TIMESTAMP] No hay entradas en task-log.md para el $DATE. Saltando resumen."
  exit 0
fi

SUCCESS=$(printf '%s
' "$ENTRIES" | grep -ciE '^([-*+][[:space:]]+)?\*\*Estado:\*\*.*(✅|finalizada exitosamente|exitosamente|completada)' || true)
ERRORS=$(printf '%s
' "$ENTRIES" | grep -ciE '^([-*+][[:space:]]+)?\*\*Estado:\*\*.*(❌|error|fallida)' || true)
ACTIVE=$(printf '%s
' "$ENTRIES" | grep -ciE '^([-*+][[:space:]]+)?\*\*Estado:\*\*.*(🔄|(^|[^[:alpha:]])activa([^[:alpha:]]|$)|en progreso|in_progress)' || true)
PENDING=$(printf '%s
' "$ENTRIES" | grep -ciE '^([-*+][[:space:]]+)?\*\*Estado:\*\*.*(⏳|⚠️|espera|pendiente|waiting|bloquead)' || true)

if [ "$MODE" = "--all" ] || [ "$MODE" = "--summary-only" ]; then
  if grep -Fqx "## Resumen $DATE" "$DAILY_SUMMARY"; then
    echo "[$TIMESTAMP] El resumen $DATE ya existe; no se duplica."
  else
    {
      echo ""
      echo "## Resumen $DATE"
      echo ""
      echo "**Generado:** $TIMESTAMP"
      echo ""
      echo "| Estado | Cantidad |"
      echo "|--------|----------|"
      echo "| ✅ Finalizada exitosamente | $SUCCESS |"
      echo "| ❌ Finalizada con error | $ERRORS |"
      echo "| 🔄 Activa | $ACTIVE |"
      echo "| ⏳ En espera de acción de usuario | $PENDING |"
      echo ""
      echo "### Detalle de tareas"
      echo ""
      echo "$ENTRIES"
      echo ""
      echo "---"
    } >> "$DAILY_SUMMARY"
  fi
fi

if [ "$MODE" = "--all" ] || [ "$MODE" = "--cleanup-only" ]; then
  {
    echo "# Task Log - Demeter"
    echo ""
    echo "> **Archivo volátil**: Se reinicia automáticamente cada 24 horas a las 05:00 AM (hora Chile, America/Santiago)."
    echo "> No editar manualmente fuera del flujo automático."
    echo ""
    echo "---"
    echo ""
    echo "<!-- ENTRADAS -->"
  } > "$TASK_LOG"
fi

chmod 0644 "$TASK_LOG" "$DAILY_SUMMARY" 2>/dev/null || true

cd "$REPO_DIR"
ensure_git_identity
git add task-log.md daily-summary.md
if git diff --cached --quiet; then
  echo "[$TIMESTAMP] No hay cambios para commitear."
else
  case "$MODE" in
    --summary-only) COMMIT_MESSAGE="docs: daily task summary for $DATE" ;;
    --cleanup-only) COMMIT_MESSAGE="chore: daily task log cleanup for $DATE" ;;
    *) COMMIT_MESSAGE="chore: daily task log cleanup and summary for $DATE" ;;
  esac
  git commit -m "$COMMIT_MESSAGE" --no-verify
  if [ "$PUSH_ENABLED" = "0" ]; then
    echo "[$TIMESTAMP] Push deshabilitado por DATASEED_CLEANUP_PUSH=0."
  else
    set +e
    push_tracking_branch "$COMMIT_MESSAGE"
    PUSH_RC=$?
    set -e
    if [ "$PUSH_RC" -eq 3 ]; then
      echo "[$TIMESTAMP] WARNING: actualización concurrente preservada; limpieza diferida."
      exit 0
    elif [ "$PUSH_RC" -ne 0 ]; then
      exit "$PUSH_RC"
    fi
  fi
fi

case "$MODE" in
  --summary-only) echo "[$TIMESTAMP] Resumen diario generado sin limpiar task-log.md." ;;
  --cleanup-only) echo "[$TIMESTAMP] task-log.md limpiado después de publicar reportes y correos." ;;
  *) echo "[$TIMESTAMP] Limpieza completada. Resumen agregado al daily-summary.md." ;;
esac
