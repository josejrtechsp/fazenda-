#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

JSX="$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx"
CSS="$ROOT_DIR/frontend/src/styles/producer_dashboard_showcase.css"

[ -f "$JSX" ] || { echo "ERRO: ProducerDashboard.jsx nao encontrado"; exit 1; }
[ -f "$CSS" ] || { echo "ERRO: producer_dashboard_showcase.css nao encontrado"; exit 1; }

echo "== Verificando IDEAL Fazenda Front V14 (dashboard showcase) =="
cd "$ROOT_DIR/frontend"

# build real
npm run build >/dev/null

echo "OK: build passou (dashboard showcase)."
