#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

test -f "$ROOT/frontend/src/styles/fazenda_extras.css"
test -f "$ROOT/frontend/src/pages/AreasPasture.jsx"

grep -q "V4 FIX3C: KPI grid" "$ROOT/frontend/src/styles/fazenda_extras.css"
grep -q "faz-mapGrid" "$ROOT/frontend/src/pages/AreasPasture.jsx"
grep -q "grid-template-columns: repeat(auto-fit" "$ROOT/frontend/src/styles/fazenda_extras.css"

echo "OK: IDEAL Fazenda Front V4 FIX3C (KPI grid + Pasto modo Mapa)."
