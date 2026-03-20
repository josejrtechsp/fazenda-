#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_lotsall_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# If lotsAll already exists as const, nothing to do
if re.search(r'\bconst\s+lotsAll\b', t):
    print("OK: lotsAll já existe.")
    raise SystemExit(0)

# Insert fallback near where lotById is defined (best spot)
insert = """\
  // FIX V12.1: fallback para lista de lotes/mangas (nomes variam entre versões)
  const lotsAll = (typeof lotsAll !== "undefined" && Array.isArray(lotsAll)) ? lotsAll
    : (typeof lots !== "undefined" && Array.isArray(lots)) ? lots
    : (typeof lotes !== "undefined" && Array.isArray(lotes)) ? lotes
    : (typeof lotsList !== "undefined" && Array.isArray(lotsList)) ? lotsList
    : (typeof lotList !== "undefined" && Array.isArray(lotList)) ? lotList
    : (typeof lotsData !== "undefined" && Array.isArray(lotsData)) ? lotsData
    : (typeof lotesAll !== "undefined" && Array.isArray(lotesAll)) ? lotesAll
    : [];
"""

# Find a stable anchor: after definition of lotById or lotsById
anchor = re.search(r'(const\s+lotById\s*=\s*useMemo\([\s\S]*?\);\s*\n)', t)
if anchor:
    pos = anchor.end(1)
    t2 = t[:pos] + "\n" + insert + "\n" + t[pos:]
    p.write_text(t2, encoding="utf-8")
    print("OK: lotsAll fallback inserido após lotById.")
    raise SystemExit(0)

# Fallback: after first useMemo block
m2 = re.search(r'(useMemo\([\s\S]*?\);\s*\n)', t)
if m2:
    pos = m2.end(1)
    t2 = t[:pos] + "\n" + insert + "\n" + t[pos:]
    p.write_text(t2, encoding="utf-8")
    print("OK: lotsAll fallback inserido após primeiro useMemo.")
    raise SystemExit(0)

# Last resort: before return (
t2 = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)
p.write_text(t2, encoding="utf-8")
print("OK: lotsAll fallback inserido antes do return.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_lotsall_$TS"
