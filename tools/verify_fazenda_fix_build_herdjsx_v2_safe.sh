#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

echo "Verificando se ainda existe \\" em contexto JSX..."
python3 - <<'PY'
from pathlib import Path
s = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")
bs = chr(92)
patterns = [
    'className=' + bs + '"',
    'tab === ' + bs + '"',
    '<div className=' + bs + '"',
    '<button' + ' className=' + bs + '"',
]
bad = [p for p in patterns if p in s]
if bad:
    raise SystemExit("ERRO: ainda há escapes problemáticos: " + ", ".join(bad))
print("OK ✅ Não encontrei padrões comuns de JSX com escapes.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
