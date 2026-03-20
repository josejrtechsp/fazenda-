#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_animalsview_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
txt = p.read_text(encoding="utf-8", errors="ignore")

if "const [animalsView, setAnimalsView]" in txt:
    print("OK: animalsView já existe. Nada a fazer.")
    raise SystemExit(0)

lines = txt.splitlines(True)
insert_line = '  const [animalsView, setAnimalsView] = useState("cards"); // cards | table\n'

# 1) tenta inserir logo após sortKey
idx = None
for i,l in enumerate(lines):
    if re.search(r'^\s*const\s*\[\s*sortKey\s*,\s*setSortKey\s*\]\s*=\s*useState\(', l):
        idx = i + 1
        break

# 2) fallback: após primeiro useState
if idx is None:
    for i,l in enumerate(lines):
        if "useState(" in l and re.search(r'^\s*const\s*\[', l):
            idx = i + 1
            break

# 3) fallback: antes do primeiro return (
if idx is None:
    for i,l in enumerate(lines):
        if re.search(r'^\s*return\s*\(', l):
            idx = i
            break

if idx is None:
    idx = 0

lines.insert(idx, insert_line)
p.write_text("".join(lines), encoding="utf-8")
print("OK: animalsView inserido em", p, "linha", idx+1)
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_animalsview_$TS"
