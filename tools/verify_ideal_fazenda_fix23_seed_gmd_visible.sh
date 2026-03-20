#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
B1="$ROOT/backend/app/routers/herd.py"
F1="$ROOT/frontend/src/pages/Herd.jsx"

echo "== verify FIX23 (Seed + GMD visível) =="

for f in "$B1" "$F1"; do
  if [[ ! -f "$f" ]]; then
    echo "ERRO: arquivo não encontrado: $f" >&2
    exit 1
  fi
done

if ! grep -q "gmd_label" "$B1"; then
  echo "ERRO: backend herd.py não tem gmd_label (FIX23 não aplicado)." >&2
  exit 1
fi

if ! grep -q "seed_map" "$B1"; then
  echo "ERRO: backend herd.py não tem seed_map (FIX23 não aplicado)." >&2
  exit 1
fi

if ! grep -q "gDot" "$F1"; then
  echo "ERRO: Herd.jsx não tem indicador de GMD (FIX23 não aplicado)." >&2
  exit 1
fi

echo "OK: FIX23 aplicado." 
