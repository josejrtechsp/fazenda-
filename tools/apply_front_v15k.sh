#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONT="$ROOT_DIR/frontend"
CSS_IMPORT='import "./styles/fazenda_tight_v15k.css";'

# Try to inject into src/main.jsx or src/main.tsx
for f in "$FRONT/src/main.jsx" "$FRONT/src/main.tsx"; do
  if [ -f "$f" ]; then
    if grep -Fq "fazenda_tight_v15k.css" "$f"; then
      echo "OK: import já existe em $f"
      exit 0
    fi
    # Insert after last import
    python3 - <<PY
from pathlib import Path
p=Path("$f")
s=p.read_text(encoding="utf-8", errors="ignore").splitlines(True)
ins=None
for i,line in enumerate(s):
    if line.strip().startswith("import "):
        ins=i+1
if ins is None:
    ins=0
s.insert(ins, "$CSS_IMPORT\n")
p.write_text("".join(s), encoding="utf-8")
print("OK: import inserido em", p)
PY
    exit 0
  fi
done

echo "ERRO: não achei src/main.jsx nem src/main.tsx"
exit 1
