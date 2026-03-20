#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F="$ROOT/frontend/src/pages/ProducerDashboard.jsx"
C="$ROOT/frontend/src/styles/producer_dashboard_fix.css"

[[ -f "$F" ]] || { echo "ERRO: falta $F"; exit 1; }
[[ -f "$C" ]] || { echo "ERRO: falta $C"; exit 1; }

grep -q "pd-tabs" "$F" || { echo "ERRO: ProducerDashboard sem pd-tabs"; exit 1; }
grep -q "VIEWS\.COST_EVOLUTION" "$F" || { echo "ERRO: VIEWS não encontrado"; exit 1; }
grep -q "FIX12" "$F" || echo "WARN: não encontrou FIX12 no header (ok)"

grep -q "\.pd-tabs" "$C" || { echo "ERRO: CSS sem .pd-tabs"; exit 1; }
grep -q "\.pd-table" "$C" || { echo "ERRO: CSS sem tabela"; exit 1; }

echo "OK: FIX12 (Dashboard navegação por botões) presente." 
