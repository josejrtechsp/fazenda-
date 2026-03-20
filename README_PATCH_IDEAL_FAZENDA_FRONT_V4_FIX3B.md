# PATCH IDEAL Fazenda Front - V4 FIX3B

## O que muda
- Remove a faixa de debug "Período (mês) / API" do dashboard.
- Ajusta o grid dos KPIs para ficar mais compacto e com 3 colunas em telas tipo iPad (reduz altura).
- Mantém o layout base CRAS/IDEAL; altera somente o dashboard do produtor.

## Aplicação
unzip -o PATCH_...zip -d .
bash tools/verify_ideal_fazenda_front_standalone_v4_fix3b.sh
rm -rf frontend/.vite
npm run dev
