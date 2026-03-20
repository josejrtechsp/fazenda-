#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"

if [ ! -f "$FILE" ]; then
  echo "ERRO: arquivo não encontrado: $FILE"
  echo "Rode na raiz do projeto (onde existe a pasta frontend/)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_$TS"

python3 - <<'PY'
import re
from pathlib import Path

p = Path("frontend/src/pages/Herd.jsx")
txt = p.read_text(encoding="utf-8", errors="ignore")
lines = txt.splitlines(True)

def is_bycat_def(line: str) -> bool:
    return re.search(r'^\s*(const|let|var)\s+byCat\s*=', line) is not None

# garantir import de useMemo
if "useMemo" not in lines[0]:
    # procura import React...
    for i,l in enumerate(lines[:20]):
        if l.startswith("import React"):
            # adiciona useMemo no import se não tiver
            m = re.search(r'\{([^}]*)\}', l)
            if m and "useMemo" not in m.group(1):
                inside = m.group(1).strip()
                parts = [x.strip() for x in inside.split(",") if x.strip()]
                parts.append("useMemo")
                new_inside = ", ".join(dict.fromkeys(parts))  # remove duplicados preservando ordem
                lines[i] = re.sub(r'\{[^}]*\}', "{ " + new_inside + " }", l)
            break

# remover defs existentes de byCat (evita duplicidade/ordem errada)
lines = [l for l in lines if not is_bycat_def(l)]

# inserir byCat após a linha do useState summary
insert_at = None
pat = re.compile(r'^\s*const\s*\[\s*summary\s*,\s*setSummary\s*\]\s*=\s*useState\(')
for i,l in enumerate(lines):
    if pat.search(l):
        insert_at = i + 1
        break

if insert_at is None:
    # fallback: após primeira ocorrência de setSummary/useState
    for i,l in enumerate(lines):
        if "setSummary" in l and "useState" in l:
            insert_at = i + 1
            break

if insert_at is None:
    # fallback final: antes do primeiro return (
    for i,l in enumerate(lines):
        if re.search(r'^\s*return\s*\(', l):
            insert_at = i
            break

if insert_at is None:
    insert_at = 0

ins = "  const byCat = useMemo(() => summary?.by_category || {}, [summary]);\n"
lines.insert(insert_at, ins)

p.write_text("".join(lines), encoding="utf-8")
print("OK: byCat via useMemo inserido em", p)
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_$TS"
