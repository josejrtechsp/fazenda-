# IDEAL Fazenda — Front Fix: Top custos por categoria (Producer Dashboard)

## Problema
O backend retorna `top_costs` como **lista** de objetos (ex.: `{group, value_brl}`),
mas o front estava tratando `top_costs` como **objeto** (`{PASTO: ..., NUTRICAO: ...}`),
resultando em **R$ 0,00** em todas as categorias no card "O que mais puxou seu custo".

## O que este patch faz
- Ajusta `frontend/src/pages/ProducerDashboard.jsx` para aceitar `top_costs` em **dois formatos**:
  - `[{group: "Nutrição", value_brl: 105.0}, ...]`
  - `{ "NUTRICAO": 105.0, ... }` ou `{ "Nutrição": 105.0, ... }`
- Mantém o layout atual.

## Como aplicar
```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ" || exit 1

mv "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_V12_FIX_TOP_COSTS.zip" "$PROJ/" 2>/dev/null || true
unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V12_FIX_TOP_COSTS.zip" -d .

bash tools/verify_ideal_fazenda_front_fix_top_costs.sh

cd "$PROJ/frontend"
npm run dev
```
