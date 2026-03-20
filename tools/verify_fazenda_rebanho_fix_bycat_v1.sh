#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
FILE="$ROOT/frontend/src/pages/Herd.jsx"

if [ ! -f "$FILE" ]; then
  echo "ERRO: arquivo não encontrado: $FILE"
  exit 1
fi

echo "Verificando byCat..."
python3 - <<'PY'
import re
from pathlib import Path

p = Path("frontend/src/pages/Herd.jsx")
lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()

def is_def(line: str) -> bool:
    return re.search(r'^\s*(const|let|var)\s+byCat\s*=', line) is not None

first_def = None
first_use = None
for i,l in enumerate(lines):
    if "byCat" in l:
        if is_def(l) and first_def is None:
            first_def = i
        if (not is_def(l)) and first_use is None:
            first_use = i

print("first_def =", first_def, "first_use =", first_use)
if first_use is None:
    print("OK: não há uso de byCat.")
    raise SystemExit(0)
if first_def is None or first_def > first_use:
    raise SystemExit("ERRO: byCat ainda está sendo usado antes de ser definido.")
print("OK ✅ Ordem correta (def antes do uso).")
PY

# opcional: build (se node_modules já existir)
if [ -d "$ROOT/frontend/node_modules" ]; then
  echo "Rodando build do frontend (opcional)..."
  (cd "$ROOT/frontend" && npm run -s build) || { echo "ERRO: build falhou"; exit 1; }
else
  echo "INFO: node_modules não encontrado; pulei npm run build."
fi

echo "OK ✅ Verify concluído."
