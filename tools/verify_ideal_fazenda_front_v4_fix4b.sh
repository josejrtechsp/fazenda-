#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$ROOT/frontend/src/pages/ProducerDashboard.jsx"

if [[ ! -f "$T" ]]; then
  echo "FALTA: $T"
  exit 1
fi

python3 "$ROOT/tools/apply_ideal_fazenda_front_v4_fix4b_wrapjsx.py" >/dev/null

grep -q "return (" "$T" || { echo "FALTA: return (" ; exit 2; }
grep -q "<>" "$T" || { echo "FALTA: fragment <>"; exit 3; }
grep -q "</>" "$T" || { echo "FALTA: fragment </>"; exit 4; }

echo "OK: IDEAL Fazenda Front V4 FIX4B (JSX wrap ProducerDashboard)"
