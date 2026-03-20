#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"

echo "== Verificando IDEAL Fazenda Front V9 (Herd API) =="

npm run build

echo "OK: build passou (Front V9 Herd API)."
