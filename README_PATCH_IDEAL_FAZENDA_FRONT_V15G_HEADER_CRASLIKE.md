# PATCH IDEAL Fazenda Front V15G - Cabeçalho estilo CRAS

Este patch deixa o cabeçalho do IDEAL Fazenda com o mesmo "hero header" do CRAS, sem informações de usuário/município/unidade.

## O que muda
- Substitui `frontend/src/components/FazendaTopHeader.jsx` por um cabeçalho no estilo CRAS.
- Adiciona `frontend/src/styles/fazenda_topheader_craslike.css` com:
  - Pílula superior
  - Título grande com palavra em degradê roxo->verde
  - Subtítulo
  - Lockup no topo-direita: logo IDEAL nítido + `IDEAL - SOLUÇÕES PARA PECUÁRIA` em degradê roxo->verde
- Inclui `tools/verify_ideal_fazenda_front_v15g_header.sh` (roda `npm run build`).

## Como aplicar
```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"

unzip -o PATCH_IDEAL_FAZENDA_FRONT_V15G_HEADER_CRASLIKE.zip -d .

bash tools/verify_ideal_fazenda_front_v15g_header.sh

cd frontend
rm -rf .vite
npm run dev -- --port 5174
```
