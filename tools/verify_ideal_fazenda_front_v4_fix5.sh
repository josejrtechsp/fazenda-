#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

need() { [ -f "$1" ] || { echo "FALTA: $1" >&2; exit 1; }; }

need "$ROOT/frontend/src/pages/ProducerDashboard.jsx"
need "$ROOT/frontend/src/pages/AreasPasture.jsx"
need "$ROOT/frontend/src/styles/fazenda_extras.css"

grep -q "export default function ProducerDashboard" "$ROOT/frontend/src/pages/ProducerDashboard.jsx" || { echo "ERRO: ProducerDashboard sem export" >&2; exit 1; }
grep -q "faz-dash-bottom" "$ROOT/frontend/src/pages/ProducerDashboard.jsx" || { echo "ERRO: layout novo não aplicado" >&2; exit 1; }

echo "OK: FIX5 aplicado (ProducerDashboard restaurado + Mangas resumo CSS)."
