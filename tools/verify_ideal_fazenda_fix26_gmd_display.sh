#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F="$ROOT/frontend"
echo "== verify FIX26 (GMD display) =="
test -f "$F/src/pages/Herd.jsx"
test -f "$F/src/styles/herd_rebanho_fix.css"
echo "OK"
