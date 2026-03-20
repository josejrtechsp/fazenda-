#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda Front V15 (dashboard cliente + marca) =="
cd "$ROOT_DIR/frontend"

npm run build

echo "OK: npm run build passou."

# sanity checks
grep -Fq "producer_dashboard_client.css" "$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx" || {
  echo "ERRO: ProducerDashboard.jsx nao importa producer_dashboard_client.css"; exit 1;
}

grep -Fq "ideal_brand_lockup.css" "$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx" || {
  echo "ERRO: ProducerDashboard.jsx nao importa ideal_brand_lockup.css"; exit 1;
}

echo "OK: arquivos e imports presentes."
