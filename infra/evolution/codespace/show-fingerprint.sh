#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$HOME/.comandiva-evolution-qa/runtime.env"
OUT="/tmp/comandiva-evolution-key-fingerprint.txt"

if [[ ! -f "$ENV_FILE" ]]; then
  printf '%s\n' 'runtime.env não encontrado' > "$OUT"
  code "$OUT"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${EVOLUTION_API_KEY:-}" ]]; then
  printf '%s\n' 'EVOLUTION_API_KEY ausente' > "$OUT"
  code "$OUT"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  FP="$(printf '%s' "$EVOLUTION_API_KEY" | sha256sum | awk '{print $1}' | cut -c1-16)"
else
  FP="$(python3 - <<'PY'
import hashlib, os
print(hashlib.sha256(os.environ['EVOLUTION_API_KEY'].encode()).hexdigest()[:16])
PY
)"
fi

printf 'Evolution QA fingerprint: %s\n' "$FP" > "$OUT"
code "$OUT"
