#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== VERIFY IDEAL FAZENDA FRONT V1 =="

# arquivos novos
for f in \
  frontend/src/FazendaApp.jsx \
  frontend/src/TelaFazendaInicioDashboard.jsx \
  frontend/src/TelaFazendaWhatsAppValidacoes.jsx \
  frontend/src/components/FazendaTopHeader.jsx \
  frontend/src/components/FazendaSidebarNav.jsx \
  frontend/src/components/FazendaPageHeader.jsx \
  frontend/src/components/IdealTopHeader.jsx
  do
  test -f "$f" || { echo "FALHA: faltando $f"; exit 1; }
done

# AppShell com mod fazenda
grep -n "FazendaApp" frontend/src/AppShell.jsx >/dev/null 2>&1 || { echo "FALHA: AppShell não importa FazendaApp"; exit 1; }
grep -n "mod === \"fazenda\"" frontend/src/AppShell.jsx >/dev/null 2>&1 || { echo "FALHA: AppShell sem condição mod=fazenda"; exit 1; }

echo "OK"
