#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
FRAG="patches/_operate_block_v11_4.jsxfrag"

[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: $FRAG não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_operateblock_v11_4_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
frag = Path("patches/_operate_block_v11_4.jsxfrag").read_text(encoding="utf-8").strip()

t = p.read_text(encoding="utf-8", errors="ignore")

# Match operate blocks with single or double quotes
pat = re.compile(r'\{\s*tab\s*===\s*["\']operate["\']\s*\?\s*\([\s\S]*?\)\s*:\s*null\s*\}', re.M)

matches = list(pat.finditer(t))
if not matches:
    raise SystemExit("ERRO: não encontrei nenhum bloco operate para substituir.")

# Replace all with placeholder markers then keep first
parts = []
last = 0
for m in matches:
    parts.append(t[last:m.start()])
    parts.append("/*__OPERATE_BLOCK__*/")
    last = m.end()
parts.append(t[last:])
t2 = "".join(parts)

# Replace first marker with frag and remove the rest
first_done = False
def repl(_):
    global first_done
    return ""

# We'll do manual replacement
out = []
i = 0
while True:
    j = t2.find("/*__OPERATE_BLOCK__*/", i)
    if j == -1:
        out.append(t2[i:])
        break
    out.append(t2[i:j])
    if not first_done:
        out.append(frag)
        first_done = True
    # else skip
    i = j + len("/*__OPERATE_BLOCK__*/")

p.write_text("".join(out), encoding="utf-8")
print(f"OK: substituídos {len(matches)} blocos operate; mantido 1.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_operateblock_v11_4_$TS"
