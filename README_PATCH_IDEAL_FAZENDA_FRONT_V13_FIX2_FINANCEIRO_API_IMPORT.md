# PATCH — IDEAL_FAZENDA FRONT V13 FIX2 (Financeiro: import do api.js + uso correto)

## Problema
Depois do V13, o sistema pode ficar **tela em branco** porque o arquivo `frontend/src/pages/Financeiro.jsx` estava fazendo:

- `import api from "../lib/api.js";`

Mas o `frontend/src/lib/api.js` do projeto exporta **named export** (`export const api = ...`), então **não existe export default**.
Isso causa erro de módulo ("does not provide an export named 'default'") e o React não renderiza nada.

## O que este patch faz
- Troca o import para **named**: `import { api } from "../lib/api.js";`
- Ajusta o uso de `api.get()` (o wrapper retorna o JSON direto, não `res.data`)
- Melhora as mensagens de erro lendo `e.data.detail` (padrão do wrapper)
- Atualiza o script de verificação para pegar esse problema antes.

## Como aplicar
No terminal (na máquina onde está o projeto):

```bash
# caminho do projeto
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ" || { echo "ERRO: não achei $PROJ"; exit 1; }

# coloca o patch dentro do projeto (se estiver em Downloads)
mv "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_V13_FIX2_FINANCEIRO_API_IMPORT.zip" "$PROJ/" 2>/dev/null || true

# aplica (sobrescreve arquivos)
unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V13_FIX2_FINANCEIRO_API_IMPORT.zip" -d .

# verifica
bash tools/verify_ideal_fazenda_front_v13_financeiro_nutricao_nav.sh

# reinicia o front
cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```

## Resultado esperado
- A tela inicial volta a renderizar (sem ficar branco)
- Aba **Financeiro** abre e carrega o resumo do mês

