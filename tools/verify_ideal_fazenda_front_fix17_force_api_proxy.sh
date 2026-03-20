#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/frontend/src/lib/api.js"

echo "== FIX17 verify: Force /api on Vite ports =="

test -f "$F" || { echo "ERRO: api.js não encontrado em $F"; exit 1; }

grep -q 'p.startsWith\("517"\)' "$F" || { echo "ERRO: regra de porta 517x não encontrada"; exit 1; }

grep -q 'return "/api"' "$F" || { echo "ERRO: retorno /api não encontrado"; exit 1; }

echo "OK: FIX17 aplicado (api base forçado para /api quando porta 517x)."
