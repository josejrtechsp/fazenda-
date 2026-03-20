#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT_DIR/frontend/src/FazendaApp.jsx"

if [ ! -f "$TARGET" ]; then
  echo "ERRO: não achei $TARGET"
  exit 1
fi

export IDEAL_FAZENDA_ROOT="$ROOT_DIR"

python3 - <<'PY'
import os
from pathlib import Path

root = Path(os.environ.get("IDEAL_FAZENDA_ROOT", ".")).resolve()
p = root / "frontend/src/FazendaApp.jsx"

if not p.exists():
    raise SystemExit(f"Arquivo não encontrado: {p}")

text = p.read_text(encoding="utf-8")
orig = text

# 1) Import
if 'from "./pages/Nutrition.jsx"' not in text:
    if 'import Herd from "./pages/Herd.jsx";' in text:
        text = text.replace(
            'import Herd from "./pages/Herd.jsx";\n',
            'import Herd from "./pages/Herd.jsx";\nimport Nutrition from "./pages/Nutrition.jsx";\n'
        )
    else:
        # fallback: insere após o último import
        lines = text.splitlines(True)
        last_imp = -1
        for i, ln in enumerate(lines):
            if ln.lstrip().startswith('import '):
                last_imp = i
        if last_imp >= 0:
            lines.insert(last_imp+1, 'import Nutrition from "./pages/Nutrition.jsx";\n')
            text = ''.join(lines)
        else:
            raise SystemExit("Não achei nenhum import no arquivo para inserir Nutrition")

# 2) Case no switch
if 'case "feed":' not in text:
    needle = '      case "whatsapp":\n'
    insert = (
        '      case "feed":\n'
        '        return <Nutrition monthKey={monthKey} />;\n\n'
    )
    if needle in text:
        text = text.replace(needle, insert + needle)
    else:
        # fallback: insere antes de default
        needle2 = '      default:\n'
        if needle2 in text:
            text = text.replace(needle2, insert + needle2)
        else:
            raise SystemExit("Não consegui achar onde inserir case 'feed' (arquivo mudou demais).")

if text != orig:
    p.write_text(text, encoding="utf-8")
    print("OK: FazendaApp.jsx atualizado (import + case feed).")
else:
    print("OK: Nada a fazer (já aplicado).")
PY
