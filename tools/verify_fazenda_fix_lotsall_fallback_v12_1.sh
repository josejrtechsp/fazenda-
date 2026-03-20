#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

grep -q "FIX V12.1: fallback para lista de lotes/mangas" "$FILE" && echo "OK ✅ fallback lotsAll presente." || { echo "ERRO: fallback lotsAll não encontrado"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
