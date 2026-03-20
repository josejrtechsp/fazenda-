# PATCH_IDEAL_FAZENDA_FRONT_V15F_HEADER_RIGHT_DEMO_DASH

## O que muda

### Cabeçalho
- Remove o chip central ("Modo Produtor") para não sobrepor.
- Remove o bloco do usuário ("José Antônio / SOFTWARE FAZENDA").
- Coloca o lockup no lado direito: **logo IDEAL nítido + texto em degradê roxo→verde**
  - `IDEAL - SOLUÇÕES PARA PECUÁRIA`

### Dashboard inicial
- Tela inicial mais detalhada e mais estilosa (cliente-ready).
- Em caso de falha de API, cai automaticamente em **modo demo** com números simulados (sem faixa vermelha).
- Forçar demo: `/?demo=1`

## Como aplicar

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"

unzip -o PATCH_IDEAL_FAZENDA_FRONT_V15F_HEADER_RIGHT_DEMO_DASH.zip -d .

bash tools/verify_ideal_fazenda_front_v15f.sh

cd frontend
rm -rf .vite
npm run dev -- --port 5174
```
