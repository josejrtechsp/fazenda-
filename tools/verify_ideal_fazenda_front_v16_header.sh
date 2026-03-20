#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

test -f "$ROOT_DIR/frontend/src/components/FazendaTopHeader.jsx"
test -f "$ROOT_DIR/frontend/src/styles/fazenda_topheader_v16.css"

# build real if frontend deps exist
if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  cd "$ROOT_DIR/frontend"
  if [ -d node_modules ]; then
    npm run build
  else
    echo "INFO: node_modules ausente; pulando npm run build"
  fi
fi

echo "OK: Front V16 header compact aplicado"
