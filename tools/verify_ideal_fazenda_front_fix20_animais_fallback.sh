#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "== verify front FIX20 (Animais fallback) =="
test -f "$ROOT/frontend/src/pages/Herd.jsx"
grep -q "fallback por lote" "$ROOT/frontend/src/pages/Herd.jsx" && echo "OK: Herd.jsx atualizado" || (echo "FAIL: Herd.jsx sem patch" && exit 1)
echo "OK"
