# PATCH — IDEAL Fazenda (Front)

**Tema:** Dashboard branco + cards com borda gradiente roxo→verde + layout mais compacto

**Data:** 2026-01-18

## O que muda
- Fundo do **Dashboard do Produtor** fica **branco**.
- Cards (KPIs, painéis, métricas e box de ações) ganham **borda gradiente roxo→verde**.
- Tipografia e espaçamentos ficam **mais compactos** (≈ -30%) para dar mais “leitura de painel”.
- Barras/indicadores passam a usar o gradiente roxo→verde.
- Botões do dashboard ficam no padrão “clean” (somente no escopo do dashboard).

## Arquivos incluídos
- `frontend/src/styles/producer_dashboard_fix.css`

## Como aplicar (macOS)
```bash
FAZ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$FAZ" || exit 1

# ajuste o caminho do ZIP conforme onde você baixou
unzip -o "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_DASHBOARD_WHITE_GRADIENT_20260118.zip" -d .

# verificação (opcional, mas recomendado)
bash tools/verify_ideal_fazenda_front_fix7c.sh
```

## Observações
- Se o `npm run dev` já estiver rodando, reinicie o Vite para carregar o CSS:
```bash
cd "$FAZ/frontend" && npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```
