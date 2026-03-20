#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F1="$ROOT/frontend/src/styles/herd_rebanho_fix.css"

echo "== verify FIX22 (Animais ações UI) =="

if [[ ! -f "$F1" ]]; then
  echo "ERRO: arquivo não encontrado: $F1" >&2
  exit 1
fi

if ! grep -q "Botões de ação do Rebanho" "$F1"; then
  echo "ERRO: patch FIX22 não parece aplicado (marcador não encontrado)." >&2
  exit 1
fi

echo "OK: FIX22 aplicado." 
