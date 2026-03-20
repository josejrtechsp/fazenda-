#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F="$ROOT/frontend/src/pages/ProducerDashboard.jsx"
C="$ROOT/frontend/src/styles/producer_dashboard_fix.css"
[[ -f "$F" ]] || { echo "ERRO: falta $F"; exit 1; }
[[ -f "$C" ]] || { echo "ERRO: falta $C"; exit 1; }
grep -q "pd-tabs" "$F" || { echo "ERRO: ProducerDashboard sem pd-tabs"; exit 1; }
grep -q "connOk" "$F" || { echo "ERRO: FIX13 sem connOk"; exit 1; }
grep -q "window.location.hostname" "$F" || { echo "ERRO: FIX13 sem fallback dinâmico de host"; exit 1; }
grep -q "pd-offline" "$C" || { echo "ERRO: CSS sem .pd-offline"; exit 1; }
echo "OK: FIX13 aplicado (offline compacto + host dinâmico)."
