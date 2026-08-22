#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Mobile VS Code can leave launch.json half-edited while opening Run/Debug.
# Restore only this generated launcher file so git pull remains deterministic.
git restore --source=HEAD -- .vscode/launch.json >/dev/null 2>&1 || true

echo "[Comandiva] Atualizando main..."
git fetch origin main
git pull --ff-only origin main

node -e 'JSON.parse(require("fs").readFileSync(".vscode/launch.json","utf8")); console.log("[Comandiva] launch.json válido.")'

echo "[Comandiva] Main sincronizada em $(git rev-parse --short HEAD)."
echo "[Comandiva] Iniciando Evolution QA..."
bash infra/evolution/codespace/start.sh

# Codespaces resets a forwarded port to private when the process is removed/re-added.
# Re-apply the intended QA visibility after the Docker stack is healthy.
if [[ -n "${CODESPACE_NAME:-}" ]] && command -v gh >/dev/null 2>&1; then
  for attempt in 1 2 3 4 5; do
    if gh codespace ports visibility 8080:public 8081:private -c "$CODESPACE_NAME" >/dev/null 2>&1; then
      echo "[Comandiva] OK: 8080 PUBLIC e 8081 PRIVATE."
      exit 0
    fi
    sleep 2
  done
  echo "[Comandiva] AVISO: não foi possível ajustar a visibilidade das portas automaticamente."
  echo "[Comandiva] Ajuste 8080 para PUBLIC e mantenha 8081 PRIVATE na aba Portas."
else
  echo "[Comandiva] AVISO: GitHub CLI indisponível; mantenha 8080 PUBLIC e 8081 PRIVATE."
fi
