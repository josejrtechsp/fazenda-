#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_v12_2_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# 1) remove bloco V12.1 (se existir)
t = re.sub(
    r'\n\s*// FIX V12\.1: fallback para lista de lotes/mangas[\s\S]*?\n\s*: \[\];\s*\n',
    "\n",
    t,
    count=1
)

# 2) troca opMangas para usar lotById dentro do marker V12
marker = "/* UX V12 VAQUEIRO */"
mi = t.find(marker)
if mi == -1:
    raise SystemExit("ERRO: marker UX V12 VAQUEIRO não encontrado.")

sub = t[mi:]
pat = re.compile(r'const\s+opMangas\s*=\s*useMemo\(\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);\s*', re.M)
m = pat.search(sub)

new_def = """const opMangas = useMemo(() => {
    try {
      const list = Array.from(lotById?.values ? lotById.values() : []);
      return list
        .map((l) => ({
          id: l.id,
          name: l.name || l.title || ("Manga " + String(l.id).padStart(2, "0")),
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
    } catch {
      return [];
    }
  }, [lotById]);
  """

if m:
    sub2 = sub[:m.start()] + new_def + sub[m.end():]
    t = t[:mi] + sub2
else:
    # fallback simples
    t = t.replace("}, [lotsAll]);", "}, [lotById]);")
    t = re.sub(
        r'const\s+list\s*=\s*Array\.isArray\(lotsAll\)\s*\?\s*lotsAll\s*:\s*\[\];',
        'const list = Array.from(lotById?.values ? lotById.values() : []);',
        t
    )

p.write_text(t, encoding="utf-8")
print("OK: V12.2 aplicado.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_v12_2_$TS"
