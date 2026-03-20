from pathlib import Path
import re

root = Path.home() / 'Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA'
app = root / 'frontend/src/FazendaApp.jsx'

if not app.exists():
    raise SystemExit(f'Nao achei {app}.')

s = app.read_text(encoding='utf-8')

# Se ja tem onGoHerd, nao mexe
if 'onGoHerd' in s and 'WhatsAppValidations' in s:
    print('OK: FazendaApp.jsx ja parece ter onGoHerd. Nada a fazer.')
    raise SystemExit(0)

# Tenta substituir somente o caso whatsapp
# Procura por return <WhatsAppValidations ... /> e injeta prop
m = re.search(r'(case\s+"whatsapp"\s*:\s*\n\s*return\s*<WhatsAppValidations)([^>]*?)(\s*/>\s*;)', s)
if m:
    before, attrs, after = m.group(1), m.group(2), m.group(3)
    if 'onGoHerd' not in attrs:
        new = before + attrs + ' onGoHerd={() => setActive("herd")}' + after
        s2 = s[:m.start()] + new + s[m.end():]
        app.write_text(s2, encoding='utf-8')
        print('OK: injetado onGoHerd em FazendaApp.jsx (case whatsapp).')
    else:
        print('OK: ja tinha onGoHerd no case whatsapp.')
else:
    # fallback: substitui tag simples <WhatsAppValidations />
    if '<WhatsAppValidations />' in s:
        s2 = s.replace('<WhatsAppValidations />', '<WhatsAppValidations onGoHerd={() => setActive("herd")} />')
        app.write_text(s2, encoding='utf-8')
        print('OK: injetado onGoHerd (replace direto).')
    else:
        print('AVISO: nao consegui localizar onde renderiza WhatsAppValidations. Nenhuma alteracao feita.')
