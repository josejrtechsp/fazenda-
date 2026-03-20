#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F1="$ROOT/frontend/src/pages/AreasPasture.jsx"
F2="$ROOT/frontend/src/styles/fazenda_extras.css"

[ -f "$F1" ] || { echo "FALTA: $F1"; exit 1; }
[ -f "$F2" ] || { echo "FALTA: $F2"; exit 1; }

grep -q "FIX6: refaz \"Mapa das mangas\"" "$F1" || { echo "FALTA: marker FIX6 em AreasPasture.jsx"; exit 1; }
grep -q "FIX6: Mangas & Pasto" "$F2" || { echo "FALTA: marker FIX6 em fazenda_extras.css"; exit 1; }

echo "OK: IDEAL Fazenda Front FIX6 (Mapa das mangas refeito)."
