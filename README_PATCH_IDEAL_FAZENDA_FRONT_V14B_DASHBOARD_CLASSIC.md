# PATCH IDEAL Fazenda Front V14B — Dashboard Classic (apresentavel)

Este patch **desfaz o visual "showcase"** e volta para o **layout CRAS/IDEAL** (cards + paineis), com melhorias leves:

- Botao **Copiar WhatsApp** (usa `/producer/monthly-summary-text?month=YYYY-MM`).
- `top_costs` robusto (aceita objeto ou lista).
- "Seed demo" fica escondido (aparece apenas com `?dev=1`).

## Aplicar

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V14B_DASHBOARD_CLASSIC.zip -d .

bash tools/verify_ideal_fazenda_front_v14b_dashboard_classic.sh

cd frontend
rm -rf .vite
npm run dev -- --port 5174
```
