#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado"; exit 1; }

echo "Verificando byCat..."
python3 - <<'PY'
import re
from pathlib import Path

p = Path("frontend/src/pages/Herd.jsx")
lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()

def is_def(l): 
    return re.search(r'^\s*(const|let|var)\s+byCat\s*=', l) is not None

defs = [i for i,l in enumerate(lines) if is_def(l)]
uses = [i for i,l in enumerate(lines) if ("byCat" in l and not is_def(l))]

print("defs:", defs[:5], "uses:", uses[:5])
if not defs:
    raise SystemExit("ERRO: não existe definição de byCat.")
if len(defs) > 1:
    raise SystemExit(f"ERRO: múltiplas definições de byCat: {defs}")
if uses and defs[0] > uses[0]:
    raise SystemExit("ERRO: byCat ainda está sendo usado antes de ser definido.")
print("OK ✅ byCat definido corretamente antes do uso.")
PY

if [ -d "frontend/node_modules" ]; then
  echo "Rodando build do frontend..."
  (cd frontend && npm run -s build)
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
