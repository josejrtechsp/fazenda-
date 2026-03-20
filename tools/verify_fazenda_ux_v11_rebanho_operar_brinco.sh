#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

grep -q 'key: "operate"' "$FILE" && echo "OK ✅ Action operate presente." || { echo "ERRO: action operate não encontrado"; exit 1; }
grep -q 'tab === "operate"' "$FILE" && echo "OK ✅ Bloco operate presente." || { echo "ERRO: bloco operate não encontrado"; exit 1; }
grep -q 'const \[opQ, setOpQ\]' "$FILE" && echo "OK ✅ opQ state presente." || { echo "ERRO: opQ state não encontrado"; exit 1; }
grep -q 'const opQNorm' "$FILE" && echo "OK ✅ opQNorm presente." || { echo "ERRO: opQNorm não encontrado"; exit 1; }

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
