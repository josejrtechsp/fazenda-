# PATCH IDEAL FAZENDA FRONT — V4 FIX1

- Corrige erro do Vite: imports de `AreaDetail.jsx`, `AreasPasture.jsx`, `Herd.jsx` (garante que existam).
- Ajusta o CSS dos KPIs (cards do produtor) para ficar **mais compacto** e ocupar menos altura, mantendo estilo CRAS.

## Aplicar
```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_STANDALONE_V4_FIX1_COMPACT_AND_PAGES.zip -d .
bash tools/verify_ideal_fazenda_front_standalone_v4_fix1.sh
cd "$PROJ/frontend"
npm run dev
```
