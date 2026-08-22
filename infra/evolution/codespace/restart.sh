#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "[Comandiva] Atualizando main..."
git pull --ff-only

echo "[Comandiva] Iniciando Evolution QA..."
bash infra/evolution/codespace/start.sh
