#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "[Comandiva] Atualizando main..."
git fetch origin main
git pull --ff-only origin main
echo "[Comandiva] Main sincronizada em $(git rev-parse --short HEAD)."

echo "[Comandiva] Iniciando Evolution QA..."
bash infra/evolution/codespace/start.sh
