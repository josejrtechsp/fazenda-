#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"
# build real
npm run build
# sanity
grep -Fq "fazenda_dashboard_scale_v15m.css" src/pages/ProducerDashboard.jsx || { echo "ERRO: import CSS faltando"; exit 1; }
grep -Fq "faz-dash-tight25" src/pages/ProducerDashboard.jsx || { echo "ERRO: class faz-dash-tight25 faltando"; exit 1; }
echo "OK: Front V15M Tight25" 
