# PATCH IDEAL FAZENDA FRONT V4 FIX2 — Dependências fixadas (Vite)

## O que corrige
- Corrige erro do Vite/plugin-react pedindo `@rolldown/pluginutils`.
- Fixamos as versões para um conjunto estável:
  - `vite = 5.4.8`
  - `@vitejs/plugin-react = 4.2.1`

## Como aplicar
1) Pare o `npm run dev` (Ctrl+C)
2) Aplique o patch na raiz do projeto
3) Reinstale dependências (IMPORTANTE)

```bash
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_STANDALONE_V4_FIX2_PIN_VITE_DEPS.zip -d .

bash tools/verify_ideal_fazenda_front_standalone_v4_fix2.sh

cd frontend
rm -rf node_modules package-lock.json .vite
npm install
npm run dev
```
