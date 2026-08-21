#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="$HOME/.comandiva-evolution-qa"
ENV_FILE="$RUNTIME_DIR/runtime.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "A configuração ainda não existe. Rode: bash infra/evolution/codespace/start.sh"
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

1. Confirme que a porta 8080 está PUBLIC no painel PORTS do Codespaces.
2. Abra $EVOLUTION_PUBLIC_URL/ e confirme resposta.
3. Cadastre os dois valores acima nos Edge Function secrets do Supabase.
4. Não envie a EVOLUTION_API_KEY por chat e não salve em arquivo do repositório.

EOF
