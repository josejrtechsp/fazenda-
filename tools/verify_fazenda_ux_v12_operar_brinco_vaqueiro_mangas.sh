#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

grep -q "UX V12 VAQUEIRO" "$FILE" && echo "OK ✅ marker V12 encontrado." || { echo "ERRO: marker V12 não encontrado"; exit 1; }
grep -q 'tab === "operate" && (' "$FILE" && echo "OK ✅ operate usando &&." || echo "AVISO: operate && não encontrado (verifique)."

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
