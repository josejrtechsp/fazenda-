#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
FRAG="patches/_ux_v11_operar_brinco.jsxfrag"

[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }
[ -f "$FRAG" ] || { echo "ERRO: $FRAG não encontrado."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_operar_brinco_fixnav_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
frag = Path("patches/_ux_v11_operar_brinco.jsxfrag").read_text(encoding="utf-8")

t = p.read_text(encoding="utf-8", errors="ignore")

# 1) default tab -> operate (se existir state tab)
t = re.sub(
    r'const\s*\[\s*tab\s*,\s*setTab\s*\]\s*=\s*useState\("([^"]+)"\);',
    'const [tab, setTab] = useState("operate");',
    t,
    count=1
)

# 2) inserir opQ state após tab (se não existir)
if 'const [opQ, setOpQ]' not in t:
    t = re.sub(
        r'(const\s*\[\s*tab\s*,\s*setTab\s*\]\s*=\s*useState\("operate"\);\s*\n)',
        r'\1  const [opQ, setOpQ] = useState("");\n',
        t,
        count=1
    )

# 3) inserir computados opQNorm/opMatches/opExact (se não existir)
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
    # tenta logo após byCat
    t2 = re.sub(
        r'(const\s+byCat\s*=\s*summary\?\.by_category\s*\|\|\s*\{\};\s*\n)',
        r'\1\n' + insert,
        t,
        count=1
    )
    if t2 == t:
        # fallback: antes do return
        t2 = re.sub(r'(return\s*\(\s*\n)', insert + r'\1', t, count=1)
    t = t2

# 4) inserir bloco operate antes da overview (se não existir)
if 'tab === "operate"' not in t:
    t = t.replace('{tab === "overview" ? (', frag + '{tab === "overview" ? (')

# 5) inserir botão/chip de navegação "Operar (brinco)" clonando a linha da "Visão geral"
# Procura a primeira linha que tenha setTab("overview") e texto "Visão geral"
if 'setTab("operate")' not in t:
    lines = t.splitlines(True)
    inserted = False
    for i, ln in enumerate(lines):
        if 'setTab("overview")' in ln and ('Visão geral' in ln or 'Visão Geral' in ln):
            # clona mantendo classes/condições
            new_ln = ln
            new_ln = new_ln.replace('setTab("overview")', 'setTab("operate")')
            new_ln = new_ln.replace('tab === "overview"', 'tab === "operate"')
            new_ln = new_ln.replace('tab==="overview"', 'tab==="operate"')
            new_ln = new_ln.replace('>Visão geral<', '>Operar (brinco)<')
            new_ln = new_ln.replace('>Visão Geral<', '>Operar (brinco)<')
            new_ln = new_ln.replace('Visão geral', 'Operar (brinco)')
            new_ln = new_ln.replace('Visão Geral', 'Operar (brinco)')
            lines.insert(i, new_ln)
            inserted = True
            break

    # fallback: procurar qualquer setTab("overview") e inserir um botão simples antes
    if not inserted:
        for i, ln in enumerate(lines):
            if 'setTab("overview")' in ln:
                indent = re.match(r'^(\s*)', ln).group(1)
                simple = indent + '<button className={"subtab" + (tab === "operate" ? " active" : "")} type="button" onClick={() => setTab("operate")}>Operar (brinco)</button>\n'
                lines.insert(i, simple)
                inserted = True
                break

    t = "".join(lines)

p.write_text(t, encoding="utf-8")
print("OK: navegação Operar (brinco) garantida.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_operar_brinco_fixnav_$TS"
