# PATCH_IDEAL_FAZENDA_BACK_V2

## O que entra
- Novo endpoint: `GET /producer/monthly-summary?month=YYYY-MM`
- Filtro `source` e `q` no `GET /events`

## Regras do resumo mensal
- Custos vêm de eventos `type=cost` e `status=approved` com payload `{ group, value_brl }`
- Produção (@) e receita vêm de eventos `type=exit` e `status=approved` com payload `{ arrobas, value_brl }`

## Aplicar
```bash
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_BACK_V2.zip -d .
bash tools/verify_ideal_fazenda_back_v2.sh
```
