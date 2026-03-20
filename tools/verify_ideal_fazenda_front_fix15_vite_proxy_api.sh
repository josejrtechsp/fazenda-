#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONT="$ROOT/frontend"

echo "== FIX15 verify: Vite proxy + API base =="

test -f "$FRONT/vite.config.js" || { echo "ERRO: vite.config.js não encontrado"; exit 1; }

grep -q '"/api"' "$FRONT/vite.config.js" || { echo "ERRO: proxy /api não está no vite.config.js"; exit 1; }

grep -q 'target: "http://127.0.0.1:8001"' "$FRONT/vite.config.js" || { echo "ERRO: target do proxy não encontrado"; exit 1; }

test -f "$FRONT/src/lib/api.js" || { echo "ERRO: src/lib/api.js não encontrado"; exit 1; }

grep -q 'return "/api"' "$FRONT/src/lib/api.js" || { echo "ERRO: api.js não está retornando /api em DEV"; exit 1; }

echo "OK: FIX15 aplicado (proxy /api + api base)."
