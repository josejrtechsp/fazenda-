#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Front FIX HEADER V1 =="

# arquivos
[ -f "$ROOT_DIR/frontend/src/components/FazendaTopHeader.jsx" ] || { echo "FALHA: FazendaTopHeader.jsx não existe"; exit 1; }
[ -f "$ROOT_DIR/frontend/src/styles/fazenda_topheader_craslike.css" ] || { echo "FALHA: CSS do header não existe"; exit 1; }

# build (se node_modules existir)
if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  cd "$ROOT_DIR/frontend"
  if [ -d node_modules ]; then
    npm run build
  else
    echo "AVISO: node_modules não encontrado; pulei npm run build."
  fi
fi

echo "OK: FIX HEADER V1 aplicado."
