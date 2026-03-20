#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-}"
if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

BACK="$ROOT/backend"
PY312="/opt/homebrew/opt/python@3.12/bin/python3.12"

[ -d "$BACK" ] || { echo "ERRO: backend/ não encontrado em $ROOT"; exit 1; }

cd "$BACK"
[ -f "requirements.txt" ] || { echo "ERRO: requirements.txt não encontrado em $BACK"; exit 1; }
[ -x "$PY312" ] || { echo "ERRO: Python 3.12 não encontrado em $PY312 (brew install python@3.12)"; exit 1; }

echo "Usando Python 3.12: $PY312"
rm -rf .venv
"$PY312" -m venv .venv

./.venv/bin/python -m ensurepip --upgrade
./.venv/bin/python -m pip install -U pip setuptools wheel
./.venv/bin/python -m pip install -r requirements.txt

echo "OK ✅ Backend pronto."
