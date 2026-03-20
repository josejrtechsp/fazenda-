# PATCH IDEAL Fazenda - V15H (Compact UI)

Objetivo: compactar cabecalho e dashboard (harmonico), reduzindo alturas, paddings e fontes.

Arquivos:
- frontend/src/styles/fazenda_topheader_craslike.css (compactado)
- frontend/src/styles/producer_dashboard_plus.css (compactado)
- tools/verify_ideal_fazenda_front_v15h_compact_ui.sh (npm run build)

Aplicacao:

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V15H_COMPACT_UI.zip -d .
bash tools/verify_ideal_fazenda_front_v15h_compact_ui.sh
cd frontend && rm -rf .vite && npm run dev -- --port 5174
```
