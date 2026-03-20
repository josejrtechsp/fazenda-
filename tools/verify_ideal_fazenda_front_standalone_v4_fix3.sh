#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASH="$ROOT/frontend/src/pages/ProducerDashboard.jsx"
CSS="$ROOT/frontend/src/styles/fazenda_extras.css"

[ -f "$DASH" ] || { echo "FALTA: $DASH"; exit 1; }
[ -f "$CSS" ] || { echo "FALTA: $CSS"; exit 1; }

grep -q 'cras-stage-v2 faz-producer' "$DASH" || { echo "FALTA: classe faz-producer no dashboard"; exit 1; }
grep -q 'V4 FIX3: Produtor (baixo da tela)' "$CSS" || { echo "FALTA: CSS FIX3"; exit 1; }

echo "OK: IDEAL Fazenda Front V4 FIX3 (dashboard bottom mais bonito + organizado)."
