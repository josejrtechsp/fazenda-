#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Verificando UX V6 (Rebanho)..."

F1="$ROOT/frontend/src/pages/Herd.jsx"
F2="$ROOT/frontend/src/styles/herd_rebanho_fix.css"

[ -f "$F1" ] || { echo "ERRO: Herd.jsx não encontrado: $F1" >&2; exit 1; }
[ -f "$F2" ] || { echo "ERRO: herd_rebanho_fix.css não encontrado: $F2" >&2; exit 1; }

grep -q "prevTab" "$F1"
grep -q "gmdWindow" "$F1"
grep -q "faz-badges" "$F1"
grep -q "openBaixa" "$F1"

grep -q "\.faz-badge" "$F2"
grep -q "\.faz-stat\.is-warn" "$F2"
grep -q "\.faz-btn\.danger" "$F2"

echo "OK ✅ Ficha com métricas + baixa + badges está presente."

# Build opcional
if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando npm run build (frontend)..."
  (cd "$ROOT/frontend" && npm run build)
else
  echo "Aviso: frontend/node_modules não encontrado — pulando npm run build."
fi

echo "OK ✅ Verify concluído."
