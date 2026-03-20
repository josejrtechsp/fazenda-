#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
FRAG="patches/_operate_block_v11_3.jsxfrag"

[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: $FRAG não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_operateblock_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
frag = Path("patches/_operate_block_v11_3.jsxfrag").read_text(encoding="utf-8")

t = p.read_text(encoding="utf-8", errors="ignore")

pat = re.compile(r'\{\s*tab\s*===\s*["\']operate["\']\s*\?\s*\([\s\S]*?\)\s*:\s*null\s*\}', re.M)

if not pat.search(t):
    raise SystemExit("ERRO: não encontrei o bloco {tab === \"operate\" ? (...) : null} para substituir.")

t2 = pat.sub(frag.strip(), t, count=1)

p.write_text(t2, encoding="utf-8")
print("OK: bloco operate substituído por versão estável.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_operateblock_$TS"
