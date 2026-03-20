#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/frontend/src/lib/api.js"

echo "== FIX17 verify: force /api on Vite dev port =="

test -f "$F" || { echo "ERRO: api.js nao encontrado"; exit 1; }

grep -q 'p.startsWith("517")' "$F" || { echo "ERRO: regra de porta 517x nao encontrada"; exit 1; }

grep -q 'return "/api"' "$F" || { echo "ERRO: /api nao aparece em api.js"; exit 1; }

echo "OK: FIX17 aplicado (api base /api em dev)."
