#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

grep -q "UX V13 SCANNER V13 VARS" "$FILE" && echo "OK ✅ marker V13.7 encontrado." || { echo "ERRO: marker V13.7 não encontrado"; exit 1; }
grep -q "opFilaStartV13" "$FILE" && echo "OK ✅ opFilaStartV13 presente." || { echo "ERRO: opFilaStartV13 não encontrado"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi
echo "OK ✅ Verify concluído."
