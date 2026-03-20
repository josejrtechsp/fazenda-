#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
HFILE="$ROOT/frontend/src/pages/Herd.jsx"
FRAG="$ROOT/patches/FAZENDA_FIX_EXPORTLOGCSV_V2_2/_exportlogcsv_v2_2.jsxfrag"

[ -f "$HFILE" ] || { echo "ERRO: Herd.jsx não encontrado em $HFILE"; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: fragment não encontrado em $FRAG"; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/fix_exportlogcsv_v2_2_$TS"
mkdir -p "$BK"
cp -v "$HFILE" "$BK/Herd.jsx.bak"

python3 - <<'PY'
import re, sys, pathlib

hfile = pathlib.Path("frontend/src/pages/Herd.jsx")
frag = pathlib.Path("patches/FAZENDA_FIX_EXPORTLOGCSV_V2_2/_exportlogcsv_v2_2.jsxfrag").read_text(encoding="utf-8")

s = hfile.read_text(encoding="utf-8")

# Se já existir definição, não mexe
if re.search(r'function\s+exportLogCsv\b', s) or re.search(r'const\s+exportLogCsv\s*=', s):
    print("OK: exportLogCsv já existe (definição encontrada). Nada a fazer.")
    sys.exit(0)

# Encontrar componente Herd
m_herd = re.search(r'(export\s+default\s+function\s+Herd\s*\(|function\s+Herd\s*\()', s)
if not m_herd:
    print("ERRO: não encontrei declaração do componente Herd().")
    sys.exit(2)

start = m_herd.start()
# Encontrar primeiro return() dentro do componente
m_ret = re.search(r'\n\s*return\s*\(', s[start:])
if not m_ret:
    print("ERRO: não encontrei return() dentro do Herd().")
    sys.exit(3)

insert_at = start + m_ret.start()

s2 = s[:insert_at] + "\n" + frag + "\n" + s[insert_at:]
hfile.write_text(s2, encoding="utf-8")
print("OK: exportLogCsv inserido antes do return() do Herd().")
PY

echo "OK ✅ Patch aplicado. Backup em: $BK"
