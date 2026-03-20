#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v2_$TS"

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/pages/Herd.jsx")
lines = p.read_text(encoding="utf-8", errors="ignore").splitlines(True)

bs = chr(92)  # backslash
needle1 = bs + '"'
needle2 = bs + "'"

ctx_keys = [
    "<", "className", "tab ===", "type=", "onClick", "href=", "id=", "style=",
    "button", "div", "span", "label", "input", "select", "option", "return (",
    "? (", ": (", "setTab(", "setFCategory(", "setOnly"
]

fixed = []
changed = 0
for ln in lines:
    if (needle1 in ln or needle2 in ln):
        if any(k in ln for k in ctx_keys):
            new = ln.replace(needle1, '"').replace(needle2, "'")
            if new != ln:
                changed += 1
            ln = new
    fixed.append(ln)

p.write_text("".join(fixed), encoding="utf-8")
print(f"OK: linhas ajustadas = {changed}")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v2_$TS"
