# Guia rapido - Importacao Jira (Modulo Financeiro)

## Arquivo
- `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/docs/financeiro/JIRA_IMPORT_MODULO_FINANCEIRO.csv`

## Conteudo
- 5 Epics
- 34 Stories
- Distribuicao em sprints: `MVP-S1`, `MVP-S2`, `V2-S3`, `MVP-S4`, `V3-S5`

## Mapeamento sugerido no importador CSV do Jira
- `Issue Id` -> External issue ID (ou campo custom de referencia)
- `Issue Type` -> Issue Type
- `Summary` -> Summary
- `Description` -> Description
- `Priority` -> Priority
- `Labels` -> Labels
- `Epic Name` -> Epic Name (somente para Epics)
- `Epic Link` -> Epic Link (somente Stories)
- `Parent Id` -> Parent (se projeto Team-managed usar parent por ID)
- `Story Points` -> Story points
- `Sprint` -> Sprint (se campo Sprint estiver disponivel no projeto)
- `Components` -> Components
- `Acceptance Criteria` -> Acceptance Criteria (campo custom, se existir)

## Observacoes praticas
- Se o seu Jira nao usar `Parent Id` por CSV, mantenha apenas `Epic Link` para ligar Story -> Epic.
- Se o campo `Acceptance Criteria` nao existir, mapear para `Description` (append) ou criar custom field antes do import.
- Se o campo `Sprint` nao estiver habilitado, importe sem esse campo e mova os itens depois no board.

## Ordem recomendada de importacao (mais segura)
1. Importar apenas as linhas `Epic`.
2. Confirmar se os nomes dos epics ficaram corretos.
3. Importar as linhas `Story` com `Epic Link`.
4. Revisar prioridades e story points no board.

## Resultado esperado apos import
- Backlog financeiro completo, pronto para planejamento de sprint e execucao tecnica.
