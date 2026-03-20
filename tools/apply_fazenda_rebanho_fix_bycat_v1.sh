#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
FILE="$ROOT/frontend/src/pages/Herd.jsx"

if [ ! -f "$FILE" ]; then
  echo "ERRO: arquivo não encontrado: $FILE"
  echo "Rode este script na raiz do projeto (onde existe a pasta frontend/)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_$TS"

python3 - <<'PY'
import re
from pathlib import Path

p = Path("frontend/src/pages/Herd.jsx")
text = p.read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines(True)

def is_def(line: str) -> bool:
    return re.search(r'^\s*(const|let|var)\s+byCat\s*=', line) is not None

# localizar primeira ocorrência de byCat (uso) e defs
use_idx = None
for i, l in enumerate(lines):
    if "byCat" in l and not is_def(l):
        use_idx = i
        break

if use_idx is None:
    print("OK: não encontrei uso de byCat. Nada a fazer.")
    raise SystemExit(0)

def_idx = [i for i,l in enumerate(lines) if is_def(l)]

# Se já tem def antes do uso, ainda assim vamos remover defs duplicadas posteriores (se houver)
needs_insert = True
if def_idx and def_idx[0] < use_idx:
    needs_insert = False

if needs_insert:
    # tentar inserir após summary / totalActive; senão, antes do primeiro uso
    anchor = None
    for i in range(use_idx-1, -1, -1):
        if re.search(r'^\s*const\s+summary\s*=', lines[i]) or re.search(r'^\s*const\s+totalActive\s*=', lines[i]):
            anchor = i + 1
            break
    if anchor is None:
        anchor = use_idx
    ins = "  const byCat = summary?.by_category || {}\n"
    # garantir ; se o arquivo usa ; no final
    if not ins.rstrip().endswith(";"):
        ins = ins.rstrip() + ";\n"
    lines.insert(anchor, ins)

# remover definições duplicadas de byCat, preservando a primeira que aparecer no arquivo
out = []
kept = False
for l in lines:
    if is_def(l):
        if not kept:
            kept = True
            out.append(l)
        else:
            continue
    else:
        out.append(l)

p.write_text("".join(out), encoding="utf-8")
print("OK: byCat fix aplicado em", p)
PY

echo "OK ✅ Patch aplicado."
echo "Backup criado em: $FILE.bak_$TS"
