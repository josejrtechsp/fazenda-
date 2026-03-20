#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H="$ROOT/frontend/src/pages/Herd.jsx"
C="$ROOT/frontend/src/styles/herd_rebanho_fix.css"

echo "== verify rebanho animais v1 =="

[ -f "$H" ] || { echo "ERRO: faltando $H"; exit 1; }
[ -f "$C" ] || { echo "ERRO: faltando $C"; exit 1; }

grep -q "herd_rebanho_fix.css" "$H" || { echo "ERRO: Herd.jsx não importa herd_rebanho_fix.css"; exit 1; }
grep -q 'tab === "animals"' "$H" || { echo "ERRO: Tab animals não encontrado"; exit 1; }
grep -q 'faz-table' "$H" || { echo "ERRO: tabela de animais não encontrada"; exit 1; }
grep -q '.faz-herd .faz-table' "$C" || { echo "ERRO: estilos de tabela ausentes"; exit 1; }

echo "OK: rebanho animais v1"