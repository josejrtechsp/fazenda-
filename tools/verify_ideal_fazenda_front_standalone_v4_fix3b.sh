#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/frontend/src/pages/ProducerDashboard.jsx"
grep -q 'faz-grid-kpis--compact' "$ROOT/frontend/src/pages/ProducerDashboard.jsx" || { echo "FALHA: ProducerDashboard sem classe compact"; exit 1; }
grep -q 'Período (mês)' "$ROOT/frontend/src/pages/ProducerDashboard.jsx" && { echo "FALHA: debug Período (mês) ainda existe"; exit 1; }
echo "OK: IDEAL Fazenda Front V4 FIX3B (KPIs compactos + remove debug)."
