#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v3_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
lines = p.read_text(encoding="utf-8", errors="ignore").splitlines(True)

# remove linha quebrada como no log:
# <div className="texto-suave
broken_re = re.compile(r'^\s*<div\s+className="texto-suave\s*$')

# contextos onde é seguro substituir \" -> "
ctx_keys = [
    "<", "className", "tab ===", "type=", "onClick", "href=", "id=", "style=",
    "button", "div", "span", "label", "input", "select", "option", "return (",
    "? (", ": (", "setTab(", "setFCategory(", "setOnly", "grid", "card"
]

bs = chr(92)
needle1 = bs + '"'
needle2 = bs + "'"

out = []
removed = 0
changed = 0

for ln in lines:
    if broken_re.match(ln.rstrip("\n")):
        removed += 1
        continue

    if (needle1 in ln or needle2 in ln) and any(k in ln for k in ctx_keys):
        new = ln.replace(needle1, '"').replace(needle2, "'")
        if new != ln:
            changed += 1
        ln = new

    out.append(ln)

p.write_text("".join(out), encoding="utf-8")
print(f"OK: removidas={removed} linhas quebradas; ajustadas={changed} linhas com escapes.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v3_$TS"
