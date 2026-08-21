#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNTIME_DIR="$HOME/.comandiva-evolution-qa"
ENV_FILE="$RUNTIME_DIR/runtime.env"
COMPOSE_FILE="$ROOT_DIR/infra/evolution/codespace/docker-compose.yml"
CONFIG_SERVER="$ROOT_DIR/infra/evolution/codespace/config-server.py"
CONFIG_PID_FILE="$RUNTIME_DIR/config-server.pid"

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

if [[ -f "$CONFIG_PID_FILE" ]]; then
  OLD_CONFIG_PID="$(cat "$CONFIG_PID_FILE" 2>/dev/null || true)"
  if [[ -n "$OLD_CONFIG_PID" ]]; then
    kill "$OLD_CONFIG_PID" >/dev/null 2>&1 || true
  fi
fi
nohup python3 "$CONFIG_SERVER" "$ENV_FILE" >/dev/null 2>&1 &
echo $! >"$CONFIG_PID_FILE"
chmod 600 "$CONFIG_PID_FILE"

echo "[Comandiva] Recriando Evolution API QA com gateway autenticado..."
# Remove containers/orphans from older compose definitions, but preserves named volumes and DB data.
docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

for attempt in $(seq 1 60); do
  if curl --silent --fail --max-time 2 http://127.0.0.1:8080/ >/dev/null 2>&1; then
    VALID_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 -H "apikey: $EVOLUTION_API_KEY" http://127.0.0.1:8080/instance/connectionState/comandiva_security_probe || true)"
    INVALID_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 -H 'apikey: definitely-wrong-key' http://127.0.0.1:8080/instance/connectionState/comandiva_security_probe || true)"

    if [[ "$INVALID_STATUS" != "401" ]]; then
      echo "[Comandiva] ERRO: gateway não rejeitou chave inválida (HTTP $INVALID_STATUS)."
      docker compose -f "$COMPOSE_FILE" ps || true
      docker compose -f "$COMPOSE_FILE" logs --tail=120 gateway evolution || true
      exit 1
    fi
    if [[ "$VALID_STATUS" == "401" || "$VALID_STATUS" == "000" || -z "$VALID_STATUS" ]]; then
      echo "[Comandiva] ERRO: gateway rejeitou a chave válida (HTTP $VALID_STATUS)."
      docker compose -f "$COMPOSE_FILE" ps || true
      docker compose -f "$COMPOSE_FILE" logs --tail=120 gateway evolution || true
      exit 1
    fi

    echo "[Comandiva] Evolution API respondeu no endpoint raiz /."
    echo "[Comandiva] Gateway seguro validado: chave inválida -> HTTP 401; chave válida -> HTTP $VALID_STATUS."
    echo "[Comandiva] URL prevista: $EVOLUTION_PUBLIC_URL"
    echo "[Comandiva] No painel PORTS, mantenha 8080 PUBLIC e 8081 PRIVATE."
    echo "[Comandiva] A porta 8081 mostra URL/chave em uma página privada do Codespaces."
    exit 0
  fi
  sleep 2
done

echo "[Comandiva] A stack ainda não respondeu. Últimos logs:"
docker compose -f "$COMPOSE_FILE" ps || true
docker compose -f "$COMPOSE_FILE" logs --tail=120 gateway evolution || true
exit 1
