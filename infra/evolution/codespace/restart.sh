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
