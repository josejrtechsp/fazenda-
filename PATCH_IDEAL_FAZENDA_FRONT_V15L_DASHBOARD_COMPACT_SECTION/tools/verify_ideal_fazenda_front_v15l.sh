#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# aplica automaticamente antes do build
bash "$ROOT_DIR/tools/apply_front_v15l_compact_section.sh"

cd "$ROOT_DIR/frontend"

if [ ! -f package.json ]; then
  echo "ERRO: não achei package.json em $ROOT_DIR/frontend"
  exit 1
fi

npm run build

echo "OK: Front V15L (compact section) build passou."
