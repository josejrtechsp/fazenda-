# PATCH FIX11 — IDEAL FAZENDA (Frontend)

## O que muda

1) **Header (topo)**
- Remove o lockup da direita (logo + texto "IDEAL - SOLUCOES PARA PECUARIA") por enquanto.
- Mantem o estilo do cabeçalho baseado no template dos fluxos.

2) **Dashboard do Produtor**
- Deixa **ainda mais compacto**: caixas menores e fontes menores.
- Mantem fundo branco + borda gradiente roxo→verde nos cards.

## Arquivos
- `frontend/src/components/FazendaTopHeader.jsx`
- `frontend/src/styles/fazenda_header_overrides.css`
- `frontend/src/styles/producer_dashboard_fix.css`
- `tools/verify_ideal_fazenda_front_fix11_header_dashboard_compact.sh`

## Aplicacao

```bash
FAZ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$FAZ" || exit 1
unzip -o /caminho/para/PATCH_IDEAL_FAZENDA_FRONT_FIX11_HEADER_DASH_MORE_COMPACT_20260118.zip -d .
bash tools/verify_ideal_fazenda_front_fix11_header_dashboard_compact.sh
```
