#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F="$ROOT/frontend/src/pages/Herd.jsx"
if [[ ! -f "$F" ]]; then
  echo "ERRO: nao achei $F"; exit 1
fi
grep -q "Seed gerado" "$F" || { echo "ERRO: Herd.jsx nao parece atualizado"; exit 1; }
echo "OK: Herd seed notice fix aplicado." 
