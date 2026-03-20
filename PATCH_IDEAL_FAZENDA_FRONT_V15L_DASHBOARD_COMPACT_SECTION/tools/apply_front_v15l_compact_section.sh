#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DASH="$ROOT_DIR/frontend/src/pages/ProducerDashboard.jsx"

if [ ! -f "$DASH" ]; then
  echo "ERRO: não achei $DASH"
  exit 1
fi

ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
import os
from pathlib import Path

root = Path(os.environ["ROOT_DIR"]).resolve()
p = root / "frontend/src/pages/ProducerDashboard.jsx"

s = p.read_text(encoding="utf-8", errors="ignore")

# 1) garantir classe de escopo no root
if 'className="faz-page faz-producer-dashboard"' not in s:
    s = s.replace('className="faz-page"', 'className="faz-page faz-producer-dashboard"', 1)

# 2) inserir import do CSS (após imports existentes)
import_line = 'import "../styles/producer_dashboard_compact_v15l.css";\n'
if 'producer_dashboard_compact_v15l.css' not in s:
    lines = s.splitlines(True)
    last_import = 0
    for i, ln in enumerate(lines):
        if ln.strip().startswith('import '):
            last_import = i + 1
    lines.insert(last_import, import_line)
    s = ''.join(lines)

p.write_text(s, encoding="utf-8")
print("OK: ProducerDashboard.jsx atualizado (escopo + import CSS)")
PY

echo "OK: apply V15L concluído."
