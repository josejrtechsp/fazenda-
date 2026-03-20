#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
HFILE="$ROOT/frontend/src/pages/Herd.jsx"
CSS="$ROOT/frontend/src/styles/herd_rebanho_fix.css"

[ -f "$HFILE" ] || { echo "ERRO: $HFILE não encontrado"; exit 1; }
[ -f "$CSS" ] || { echo "ERRO: $CSS não encontrado"; exit 1; }

grep -q "Visão geral" "$HFILE" && echo "OK ✅ Herd.jsx presente." || { echo "ERRO: Herd.jsx não contém conteúdo esperado."; exit 1; }
grep -q "animalsView" "$HFILE" && echo "OK ✅ Toggle Lista/Tabela presente." || { echo "ERRO: animalsView não encontrado."; exit 1; }
grep -q "UX V10 — Rebanho" "$CSS" && echo "OK ✅ CSS V10 presente." || { echo "ERRO: CSS V10 não encontrado."; exit 1; }

if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd "$ROOT/frontend" && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
