#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"
echo "== Verificando IDEAL Fazenda Front V15N (tight30) =="
# build real
npm run build
# quick sanity checks
if ! grep -R --line-number -F "fazenda_dash_tight30.css" src/main.* >/dev/null 2>&1; then
  echo "ERRO: import do CSS tight30 nao encontrado em src/main" >&2
  exit 1
fi
if ! grep -R --line-number -F "faz-dash-tight30" src/pages/ProducerDashboard.jsx >/dev/null 2>&1; then
  echo "ERRO: classe faz-dash-tight30 nao encontrada no ProducerDashboard" >&2
  exit 1
fi
echo "OK: V15N build + checks." 
