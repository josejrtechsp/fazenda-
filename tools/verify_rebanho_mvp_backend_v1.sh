#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

if [ ! -d "$ROOT/backend/rebanho_mvp" ]; then
  echo "ERRO: backend/rebanho_mvp não existe. Você aplicou o patch na raiz correta?"
  exit 1
fi

echo "Verificando estrutura..."
test -f "$ROOT/backend/rebanho_mvp/main.py"
test -f "$ROOT/backend/run_rebanho_mvp.sh"

PYTHON_BIN="python3"
if [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PYTHON_BIN="$ROOT/backend/.venv/bin/python"
fi

echo "Checando dependências mínimas..."
if ! "$PYTHON_BIN" - <<'PY'
import importlib
for mod in ("fastapi", "uvicorn", "sqlmodel"):
    importlib.import_module(mod)
print("OK ✅ Dependências base encontradas.")
PY
then
  echo ""
  echo "ERRO: dependências Python não estão prontas (ex.: sqlmodel)."
  echo "Sugestão (rodar a partir da pasta backend):"
  echo "  python3 -m venv .venv"
  echo "  ./.venv/bin/pip install fastapi \"uvicorn[standard]\" sqlmodel python-multipart"
  exit 1
fi

echo "Verificando compileall e import do app..."
"$PYTHON_BIN" - <<'PY'
import sys, pathlib, compileall
root = pathlib.Path(".").resolve()
backend = root / "backend"
sys.path.insert(0, str(backend))
ok = compileall.compile_dir(str(backend/"rebanho_mvp"), quiet=1)
if not ok:
    raise SystemExit("compileall falhou")
from rebanho_mvp.main import app
print("OK ✅ Imports e compileall passaram.")
print("Título:", app.title)
PY

echo "OK ✅ Verify passou."
echo "Para rodar:"
echo "  cd backend && bash ./run_rebanho_mvp.sh"
