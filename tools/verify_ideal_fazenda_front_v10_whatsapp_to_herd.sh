#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Verificando IDEAL Fazenda Front V10 (WhatsApp -> Rebanho) =="
cd "$ROOT_DIR/frontend"
# build real
npm run build
echo "OK: build passou (Front V10)."
