#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Verificando IDEAL Fazenda Front FIX7C =="
cd "$ROOT_DIR/frontend"
# build real para pegar imports/sintaxe
npm run build
echo "OK: build passou (FIX7C)."
