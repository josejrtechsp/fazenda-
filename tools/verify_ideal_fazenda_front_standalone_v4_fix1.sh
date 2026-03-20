#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FR="$ROOT/frontend"

need(){
  if [ ! -f "$1" ]; then
    echo "FALTA: $1" >&2
    exit 1
  fi
}

need "$FR/src/FazendaApp.jsx"
need "$FR/src/pages/ProducerDashboard.jsx"
need "$FR/src/pages/WhatsAppValidations.jsx"
need "$FR/src/pages/Transfers.jsx"
need "$FR/src/pages/AreasPasture.jsx"
need "$FR/src/pages/AreaDetail.jsx"
need "$FR/src/pages/Herd.jsx"
need "$FR/src/styles/fazenda_extras.css"

grep -q "faz-grid-kpis" "$FR/src/styles/fazenda_extras.css" || { echo "FALTA CSS: faz-grid-kpis"; exit 1; }

echo "OK: IDEAL Fazenda Front V4 FIX1 (pages + KPIs compactos)"
