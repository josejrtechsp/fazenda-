#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx"
if [ ! -f "$FILE" ]; then
  echo "ERRO: nao achei $FILE"; exit 1
fi
python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/pages/ProducerDashboard.jsx")
s = p.read_text(encoding="utf-8", errors="ignore")
imp = 'import "../styles/fazenda_dashboard_scale_v15m.css";\n'
if "fazenda_dashboard_scale_v15m.css" not in s:
    lines = s.splitlines(True)
    # insere depois do ultimo import
    last = 0
    for i, ln in enumerate(lines):
        if ln.strip().startswith("import "):
            last = i + 1
    lines.insert(last, imp)
    s = "".join(lines)
# adiciona classe de escopo
s2 = s.replace('className="faz-page"', 'className="faz-page faz-dash-tight25"', 1)
if s2 != s:
    s = s2
p.write_text(s, encoding="utf-8")
print("OK: apply V15M (import + class)")
PY
