# PATCH IDEAL_FAZENDA FRONT V12 — Nutrição (Itens + Compras)

## O que adiciona
- Página: `NutricaoComprasItens` (abas Compras / Itens)
- Seed catálogo via API
- Registro de compra (preço unitário) — usado automaticamente nos lançamentos WhatsApp

## Aplicação
- `bash tools/apply_ideal_fazenda_front_v12_nutricao_admin.sh`
- `bash tools/verify_ideal_fazenda_front_v12_nutricao_admin.sh`

## Observação
A rota criada é `view="nutricao_admin"`. Você pode adicionar um item no menu depois (ou usar temporariamente via query/atalho do App, dependendo do seu shell).
