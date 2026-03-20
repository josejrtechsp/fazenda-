#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_operar_brinco_navforce_$TS"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/pages/Herd.jsx")
t = p.read_text(encoding="utf-8", errors="ignore")

# Já existe navegação?
if re.search(r'setTab\(\s*["\']operate["\']\s*\)', t):
    print("OK: já existe setTab('operate')/setTab(\"operate\"). Nada a fazer.")
    raise SystemExit(0)

def clone_button(btn_html: str) -> str:
    b = btn_html
    b = re.sub(r'setTab\(\s*["\']overview["\']\s*\)', 'setTab("operate")', b)
    b = re.sub(r'setTab\(\s*["\']animals["\']\s*\)', 'setTab("operate")', b)
    b = b.replace('tab === "overview"', 'tab === "operate"')
    b = b.replace('tab==="overview"', 'tab==="operate"')
    b = b.replace('tab === "animals"', 'tab === "operate"')
    b = b.replace('tab==="animals"', 'tab==="operate"')
    b = b.replace("Visão geral", "Operar (brinco)")
    b = b.replace("Visão Geral", "Operar (brinco)")
    b = b.replace("Animais", "Operar (brinco)")
    return b

# 1) tentar encontrar um botão completo de Visão geral (multilinha)
btn_pat = re.compile(r'(<button\b[\s\S]*?setTab\(\s*["\']overview["\']\s*\)[\s\S]*?</button>)', re.I)
m = btn_pat.search(t)
if m:
    btn = m.group(1)
    new_btn = clone_button(btn)
    t = t[:m.start(1)] + new_btn + "\n" + btn + t[m.end(1):]
    p.write_text(t, encoding="utf-8")
    print("OK: botão Operar (brinco) clonado de Visão geral.")
    raise SystemExit(0)

# 2) tentar encontrar botão de Animais
btn_pat2 = re.compile(r'(<button\b[\s\S]*?setTab\(\s*["\']animals["\']\s*\)[\s\S]*?</button>)', re.I)
m2 = btn_pat2.search(t)
if m2:
    btn = m2.group(1)
    new_btn = clone_button(btn)
    t = t[:m2.start(1)] + new_btn + "\n" + btn + t[m2.end(1):]
    p.write_text(t, encoding="utf-8")
    print("OK: botão Operar (brinco) clonado de Animais.")
    raise SystemExit(0)

# 3) Fallback: injetar mini-barra no topo do conteúdo (logo após o primeiro card-header-row)
inject = """
            <div className=\"faz-actions-row\" style={{ marginTop: 10 }}>
              <button className={{"faz-btn" + (tab === \"operate\" ? \" primary\" : \"")}} type=\"button\" onClick={{() => setTab(\"operate\")}}>
                Operar (brinco)
              </button>
              <button className={{"faz-btn" + (tab === \"overview\" ? \" primary\" : \"")}} type=\"button\" onClick={{() => setTab(\"overview\")}}>
                Visão geral
              </button>
              <button className={{"faz-btn" + (tab === \"animals\" ? \" primary\" : \"")}} type=\"button\" onClick={{() => setTab(\"animals\")}}>
                Animais
              </button>
              <button className={{"faz-btn" + (tab === \"lots\" ? \" primary\" : \"")}} type=\"button\" onClick={{() => setTab(\"lots\")}}>
                Lotes
              </button>
              <button className={{"faz-btn" + (tab === \"transfer\" ? \" primary\" : \"")}} type=\"button\" onClick={{() => setTab(\"transfer\")}}>
                Transferir
              </button>
            </div>
""".replace("{", "{{").replace("}", "}}")  # keep JSX braces literal safely
# Undo double escaping for JSX braces
inject = inject.replace("{{{", "{{").replace("}}}", "}}")

hdr_pat = re.compile(r'(<div\s+className=\"card-header-row\"[\s\S]*?</div>\s*)', re.I)
mh = hdr_pat.search(t)
if mh:
    t = t[:mh.end(1)] + inject + t[mh.end(1):]
    p.write_text(t, encoding="utf-8")
    print("OK: mini-barra de navegação injetada após card-header-row.")
    raise SystemExit(0)

# 4) último fallback: inserir no início do return
ret_pat = re.compile(r'(return\s*\(\s*\n)', re.M)
t = ret_pat.sub(r'\1' + inject + "\n", t, count=1)
p.write_text(t, encoding="utf-8")
print("OK: mini-barra de navegação injetada no início do return.")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_operar_brinco_navforce_$TS"
