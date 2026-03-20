#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
FRAG="patches/_ux_v11_operar_brinco.jsxfrag"

[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: $FRAG não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_operar_brinco_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
frag = Path("patches/_ux_v11_operar_brinco.jsxfrag").read_text(encoding="utf-8")

t = p.read_text(encoding="utf-8", errors="ignore")

# 1) default tab -> operate
t = re.sub(
    r'const\s*\[\s*tab\s*,\s*setTab\s*\]\s*=\s*useState\("([^"]+)"\);',
    'const [tab, setTab] = useState("operate");',
    t,
    count=1,
)

# 2) inserir opQ state após o state de tab (se não existir)
if 'const [opQ, setOpQ]' not in t:
    t = re.sub(
        r'(const\s*\[\s*tab\s*,\s*setTab\s*\]\s*=\s*useState\("operate"\);\s*\n)',
        r'\1  const [opQ, setOpQ] = useState("");\n',
        t,
        count=1,
    )

# 3) inserir computados opQNorm/opMatches/opExact após byCat (se não existir)
if 'const opQNorm' not in t:
    insert = """\
  const opQNorm = normalizeEarTag(opQ);

  const opMatches = useMemo(() => {
    try {
      const q = opQNorm;
      const list = Array.isArray(animalsAll) ? animalsAll : [];
      if (!q) return [];
      return list
        .filter((a) => normalizeEarTag(a?.ear_tag).includes(q))
        .slice(0, 10);
    } catch {
      return [];
    }
  }, [opQNorm, animalsAll]);

  const opExact = useMemo(() => {
    try {
      const q = opQNorm;
      if (!q) return null;
      return (opMatches || []).find((a) => normalizeEarTag(a?.ear_tag) === q) || null;
    } catch {
      return null;
    }
  }, [opQNorm, opMatches]);

"""

    t2 = re.sub(
        r'(const\s+byCat\s*=\s*summary\?\.by_category\s*\|\|\s*\{\};\s*\n)',
        r'\1\n' + insert,
        t,
        count=1,
    )
    if t2 == t:
        # fallback: antes do return (
        t2 = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)
    t = t2

# 4) Actions: inserir Operar (brinco)
if 'key: "operate"' not in t:
    t = t.replace(
        '{ key: "seed", label: "Seed Rebanho (demo)", variant: "ghost" },',
        '{ key: "seed", label: "Seed Rebanho (demo)", variant: "ghost" },\n          { key: "operate", label: "Operar (brinco)", variant: tab === "operate" ? "primary" : "ghost" },',
    )

# 5) onAction: inserir handler
if 'if (k === "operate")' not in t:
    t = t.replace(
        'if (k === "seed") return seedDemo();\n          if (k === "overview") return setTab("overview");',
        'if (k === "seed") return seedDemo();\n          if (k === "operate") return setTab("operate");\n          if (k === "overview") return setTab("overview");',
    )

# 6) inserir bloco da aba operate antes da overview (se ainda não existir)
if 'tab === "operate"' not in t:
    t = t.replace('{tab === "overview" ? (', frag + '{tab === "overview" ? (')

p.write_text(t, encoding="utf-8")
print("OK: Operar (brinco) aplicado em Herd.jsx")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_operar_brinco_$TS"
