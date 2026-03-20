#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

python3 - <<'PY'
from pathlib import Path
import re
s = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")

# não pode existir a linha quebrada
if re.search(r'^\s*<div\s+className="texto-suave\s*$', s, flags=re.M):
    raise SystemExit("ERRO: ainda existe linha quebrada <div className=\"texto-suave")

# padrões de escape comuns que quebram JSX
bs = chr(92)
bad = [
    'tab === ' + bs + '"',
    'className=' + bs + '"',
    '<div className=' + bs + '"',
    '<button className=' + bs + '"',
]
found = [p for p in bad if p in s]
if found:
    raise SystemExit("ERRO: ainda existem escapes problemáticos: " + ", ".join(found))

print("OK ✅ Herd.jsx parece limpo.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
