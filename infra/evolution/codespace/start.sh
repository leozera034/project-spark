#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNTIME_DIR="$HOME/.comandiva-evolution-qa"
ENV_FILE="$RUNTIME_DIR/runtime.env"
COMPOSE_FILE="$ROOT_DIR/infra/evolution/codespace/docker-compose.yml"

mkdir -p "$RUNTIME_DIR"
chmod 700 "$RUNTIME_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    EVOLUTION_API_KEY="$(openssl rand -hex 32)"
    POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  else
    EVOLUTION_API_KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
    POSTGRES_PASSWORD="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(24))
PY
)"
  fi

  cat >"$ENV_FILE" <<EOF
EVOLUTION_API_KEY=$EVOLUTION_API_KEY
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF
  chmod 600 "$ENV_FILE"
fi

set -a
source "$ENV_FILE"
set +a

if [[ -n "${CODESPACE_NAME:-}" ]]; then
  FORWARDING_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  export EVOLUTION_PUBLIC_URL="https://${CODESPACE_NAME}-8080.${FORWARDING_DOMAIN}"
else
  export EVOLUTION_PUBLIC_URL="http://localhost:8080"
fi

export EVOLUTION_API_KEY
export POSTGRES_PASSWORD

echo "[Comandiva] Iniciando Evolution API QA..."
docker compose -f "$COMPOSE_FILE" up -d

for attempt in $(seq 1 60); do
  if curl --silent --fail --max-time 2 http://127.0.0.1:8080/ >/dev/null 2>&1; then
    echo "[Comandiva] Evolution API respondeu no endpoint raiz /."
    echo "[Comandiva] URL prevista: $EVOLUTION_PUBLIC_URL"
    echo "[Comandiva] No painel PORTS do Codespaces, torne a porta 8080 PUBLIC antes de usar essa URL no Supabase."
    echo "[Comandiva] Para ver URL e chave de QA: bash infra/evolution/codespace/show-config.sh"
    exit 0
  fi
  sleep 2
done

echo "[Comandiva] A Evolution ainda não respondeu. Últimos logs:"
docker compose -f "$COMPOSE_FILE" logs --tail=120 evolution || true
exit 1
