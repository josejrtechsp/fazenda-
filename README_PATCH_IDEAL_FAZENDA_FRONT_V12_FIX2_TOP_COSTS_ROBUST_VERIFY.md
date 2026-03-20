# PATCH — IDEAL Fazenda Front V12 FIX2 (Top Costs robusto + verify sem erro)

## O que muda
- **ProducerDashboard**: leitura de `top_costs` ficou mais tolerante a formatos diferentes do backend.
  - aceita `data.top_costs`, `data.topCosts`, `data.top_costs_brl`, etc.
  - aceita itens no formato objeto (`{group, total_brl}`) ou lista (`["Nutrição", 225]`).
- **verify script**: corrige o erro `grep: parentheses not balanced`.

## Como aplicar
Na raiz do projeto (`IDEAL_FAZENDA`):

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"

mv "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_V12_FIX2_TOP_COSTS_ROBUST_VERIFY.zip" "$PROJ/" 2>/dev/null || true
unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V12_FIX2_TOP_COSTS_ROBUST_VERIFY.zip" -d .

bash tools/verify_ideal_fazenda_front_fix_top_costs.sh

cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```

