#!/usr/bin/env bash
set -euo pipefail

PERSISTED_ROOT="/workspaces/.codespaces/.persistedshare"
if [[ -d "$PERSISTED_ROOT/comandiva-evolution-qa" ]]; then
  RUNTIME_DIR="$PERSISTED_ROOT/comandiva-evolution-qa"
else
  RUNTIME_DIR="$HOME/.comandiva-evolution-qa"
fi
ENV_FILE="$RUNTIME_DIR/runtime.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "A configuração ainda não existe. Use Evolution: restaurar 8080 PUBLIC."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -n "${CODESPACE_NAME:-}" ]]; then
  FORWARDING_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  EVOLUTION_PUBLIC_URL="https://${CODESPACE_NAME}-8080.${FORWARDING_DOMAIN}"
else
  EVOLUTION_PUBLIC_URL="http://localhost:8080"
fi

cat <<EOF

Comandiva · Evolution QA

EVOLUTION_API_BASE_URL=$EVOLUTION_PUBLIC_URL
EVOLUTION_API_KEY=$EVOLUTION_API_KEY
CADDY_BASIC_AUTH_USER=comandiva
CADDY_BASIC_AUTH_PASSWORD=${CADDY_BASIC_AUTH_PASSWORD:-indisponivel}

1. Confirme 8080 PUBLIC e 8081 PRIVATE.
2. Cadastre os dois valores da Evolution nos Edge Function secrets do Supabase quando necessário.
3. Não envie a EVOLUTION_API_KEY nem a senha do gateway por chat e não salve nenhuma delas no repositório.

EOF
