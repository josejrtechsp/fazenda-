# PATCH IDEAL FAZENDA FRONT V5 — Nutrição

## O que entra
- Nova tela: **Operação → Nutrição**
  - Lançar trato (ração/sal/mineral) como **custo** (type=cost, group=Nutrição)
  - Lista últimos lançamentos do mês
  - KPI rápido: Nutrição no mês (R$) e Nutrição por @ (estimativa)

## Como funciona
- Ao lançar, cria evento:
  - `type=cost`
  - `status=approved`
  - `payload.group = "Nutrição"`

Isso já aparece no **Resumo do mês** e no Top 5 de custos.

## Aplicar
```bash
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V5_NUTRICAO.zip -d .

# aplica o hook no FazendaApp (não sobrescreve o arquivo inteiro)
bash tools/apply_front_v5_nutricao.sh

# build real
bash tools/verify_ideal_fazenda_front_v5_nutricao.sh
```

## Subir
```bash
cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```
