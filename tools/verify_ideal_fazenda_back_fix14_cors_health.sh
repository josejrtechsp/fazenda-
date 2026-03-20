#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK="$ROOT/backend"

echo "== verify back fix14 (cors + health HEAD) =="

if [[ ! -f "$BACK/app/config.py" ]]; then
  echo "ERRO: não achei $BACK/app/config.py" >&2
  exit 1
fi
if [[ ! -f "$BACK/app/routers/health.py" ]]; then
  echo "ERRO: não achei $BACK/app/routers/health.py" >&2
  exit 1
fi

grep -q "localhost:5174" "$BACK/app/config.py" && echo "OK: CORS inclui localhost:5174" || (echo "ERRO: CORS não inclui 5174" >&2; exit 1)
grep -q "@router.head(\"/health\")" "$BACK/app/routers/health.py" && echo "OK: /health HEAD" || (echo "ERRO: /health HEAD ausente" >&2; exit 1)

echo "OK: fix14 verificado."
