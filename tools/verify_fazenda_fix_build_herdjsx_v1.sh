#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

echo "Checando padrões comuns de JSX quebrado..."
python3 - <<'PY'
from pathlib import Path
s = Path("frontend/src/pages/Herd.jsx").read_text(encoding="utf-8", errors="ignore")
bad = []
for pat in ['className=\\"', 'type=\\"', 'onClick=\\"', '<div className=\\"', 'button className=\\"']:
    if pat in s:
        bad.append(pat)
if bad:
    raise SystemExit("ERRO: ainda encontrei escapes fora de strings: " + ", ".join(bad))
print("OK ✅ Não encontrei padrões comuns com \\.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
