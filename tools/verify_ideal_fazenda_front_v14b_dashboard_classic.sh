#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Verificando IDEAL Fazenda Front V14B (dashboard classic) =="
cd "$ROOT_DIR/frontend"
# Build real (pega import/JSX quebrado antes de abrir o navegador)
npm run build

echo "OK: build passou (V14B)."
