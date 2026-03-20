# PATCH IDEAL Fazenda Front FIX6B

## O que corrige
- Corrige erro do Vite: `Failed to resolve import ../components/PageHeader.jsx` em `src/pages/AreasPasture.jsx`.

## O que adiciona
- `frontend/src/components/PageHeader.jsx`
- `tools/verify_ideal_fazenda_front_fix6b.sh` (inclui build check)

## Como aplicar
```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V4_FIX6B_PAGEHEADER_AND_VERIFY.zip -d .

bash tools/verify_ideal_fazenda_front_fix6b.sh

cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```
