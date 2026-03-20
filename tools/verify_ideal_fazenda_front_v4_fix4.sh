#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASH="$ROOT/frontend/src/pages/ProducerDashboard.jsx"
AREAS="$ROOT/frontend/src/pages/AreasPasture.jsx"
CSS="$ROOT/frontend/src/styles/fazenda_extras.css"

echo "== Verificando IDEAL Fazenda Front V4 FIX4 =="

grep -q "FIX4: refazer resumos" "$CSS" && echo "OK: CSS FIX4 presente" || (echo "FALTA: CSS FIX4" && exit 1)
grep -q "faz-summary3" "$DASH" && echo "OK: ProducerDashboard resumo refatorado" || (echo "FALTA: resumo novo no ProducerDashboard" && exit 1)
grep -q "faz-statgrid" "$AREAS" && echo "OK: AreasPasture resumo refatorado" || (echo "FALTA: resumo novo no AreasPasture" && exit 1)

echo "OK: FIX4 pronto."
