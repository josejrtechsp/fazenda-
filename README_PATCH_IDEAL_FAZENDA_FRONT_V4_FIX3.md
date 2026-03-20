# PATCH IDEAL Fazenda Front Standalone V4 FIX3

## O que muda
- **Somente** o Dashboard do Produtor (Mês): parte de baixo (Top 5 custos + Resumo + Ações).
- Não altera layout global, nem telas de Operação (Mangas & Pasto, Rebanho etc.).
- Tudo fica **mais bonito e organizado** no padrão CRAS/IDEAL:
  - Top 5 custos com cabeçalho e empty-state quando total = 0.
  - Resumo + Alertas + Ações rápidas em 2 colunas (responsivo).
  - Botões em grid (2x2) com tamanho compacto.

## Aplicação
```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_STANDALONE_V4_FIX3_DASHBOARD_BOTTOM_UI.zip -d .
bash tools/verify_ideal_fazenda_front_standalone_v4_fix3.sh
cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```
