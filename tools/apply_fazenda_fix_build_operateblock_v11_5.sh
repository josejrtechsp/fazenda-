#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
FRAG="patches/_operate_region_v11_5.jsxfrag"

[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: $FRAG não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_operateblock_v11_5_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
frag = Path("patches/_operate_region_v11_5.jsxfrag").read_text(encoding="utf-8").rstrip() + "\n\n"

t = p.read_text(encoding="utf-8", errors="ignore")

# locate start of operate block (single or double quotes)
m = re.search(r'\{\s*tab\s*===\s*["\']operate["\']', t)
if not m:
    raise SystemExit("ERRO: não encontrei início do bloco operate.")

start = m.start()

# find next tab block after start (excluding operate)
tab_pat = re.compile(r'\{\s*tab\s*===\s*["\'](\w+)["\']')
next_pos = None
for mm in tab_pat.finditer(t, m.end()):
    if mm.group(1) != "operate":
        next_pos = mm.start()
        break

if next_pos is None:
    raise SystemExit("ERRO: não encontrei o próximo bloco de tab para delimitar o operate.")

t2 = t[:start] + frag + t[next_pos:]

p.write_text(t2, encoding="utf-8")
print("OK: região operate substituída por versão && estável.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_operateblock_v11_5_$TS"
