#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSS="$ROOT/frontend/src/styles/producer_dashboard_fix.css"
JSX="$ROOT/frontend/src/pages/ProducerDashboard.jsx"

echo "== verify_front_fix8_dashboard =="

if [ ! -f "$CSS" ]; then
  echo "ERROR: CSS not found: $CSS" >&2
  exit 1
fi

if ! grep -q "ProducerDashboard FIX8" "$CSS"; then
  echo "ERROR: CSS does not look like FIX8" >&2
  exit 1
fi

echo "OK: CSS FIX8 present"

if [ -f "$JSX" ]; then
  if grep -q "producer_dashboard_fix.css" "$JSX"; then
    echo "OK: ProducerDashboard imports producer_dashboard_fix.css"
  else
    echo "WARN: ProducerDashboard does not import producer_dashboard_fix.css"
  fi
else
  echo "WARN: ProducerDashboard.jsx not found" >&2
fi

echo "OK: verify done."
