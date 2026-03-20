# Especificacao de Produto - Modulo de Gestao Financeira (Fazenda Ideal)

## 1) Mapa priorizado de funcionalidades

### MUST (MVP)
| Item | Beneficio direto no dia a dia | Impacto | Complexidade | Dependencias |
|---|---|---|---|---|
| Cadastro de pessoas multi-tipo | Evita erro de lancamento e padroniza cliente/fornecedor | Alto | Media | Base de pessoas + validacao documento |
| Fornecedor por categoria e tags | Enxergar gasto por tipo (nutricao, sanidade, combustivel) | Alto | Media | Cadastro pessoas |
| Plano de contas N1-N4 | Classificacao padrao para DRE e analise | Alto | Alta | Seed + tela de consulta |
| Centros de custo + rateio | Custo correto por atividade (pecuaria/agricultura) | Alto | Alta | Plano de contas |
| Contas bancarias e formas de pagamento | Fluxo real de caixa por conta | Alto | Media | Cadastro tesouraria |
| Lancamento receita/despesa com parcelas | Registro operacional completo | Alto | Alta | Pessoas + plano + centros |
| Contas a pagar e a receber | Controle de vencimento e inadimplencia | Alto | Media | Movimentacoes |
| Workflow aprovar/pagar/receber | Governanca e menos risco de pagamento indevido | Alto | Alta | Perfis e permissoes |
| Conciliação bancaria | Confere sistema x extrato | Alto | Alta | Contas bancarias |
| Dashboard financeiro base | Decisao rapida do gestor | Alto | Media | Dados consolidados |
| Auditoria e logs | Rastreabilidade para controle interno | Alto | Media | Autenticacao/perfis |

### SHOULD (V2)
| Item | Beneficio | Impacto | Complexidade | Dependencias |
|---|---|---|---|---|
| RH (folha, encargos, beneficios) | Custo real de pessoal por centro | Alto | Alta | Pessoas + rateio |
| Baixa parcial em recebimentos | Controle de recebimento fracionado | Medio | Media | AR |
| Transferencia entre contas | Controle de caixa interno | Medio | Media | Contas bancarias |
| Alertas 7/15/30 dias | Antecipar falta de caixa | Medio | Baixa | AP/AR |

### COULD (V3)
| Item | Beneficio | Impacto | Complexidade | Dependencias |
|---|---|---|---|---|
| Orcado vs realizado | Controle de disciplina financeira | Alto | Alta | Base historica |
| Exportacao LCDPR (estrutura) | Facilita consolidacao fiscal | Medio | Media | Classificacao valida |
| Conectores externos (eSocial/contabilidade) | Menos retrabalho | Medio | Alta | Padrao de dados RH |

---

## 2) User stories e criterios de aceite

### US-01 Cadastro de fornecedor
- Como financeiro, quero cadastrar fornecedor com categoria e tipo de produto/servico para classificar despesas corretamente.
- Criterios de aceite:
  - Documento CPF/CNPJ validado e unico entre ativos.
  - Multi-tag permitida (ex.: `nutricao`, `sal mineral`, `suplemento`).
  - Status ativo/inativo bloqueia uso em novos lancamentos quando inativo.

### US-02 Lancar despesa operacional
- Como operador financeiro, quero lancar despesa para controlar contas a pagar e custo por centro.
- Criterios de aceite:
  - Campos obrigatorios: emissao, vencimento, fornecedor, conta N4, centro de custo, valor.
  - Sem `data_pagamento` status deve ficar `open`.
  - Rateio deve fechar 100% ou valor total.

### US-03 Programar e pagar conta
- Como gestor, quero aprovar e pagar despesas por alcada para reduzir risco.
- Criterios de aceite:
  - Titulo passa por status: `open -> approved -> paid -> reconciled`.
  - Usuario sem permissao de alcada nao consegue aprovar acima do limite.

### US-04 Lancar receita e baixar parcial
- Como financeiro, quero registrar receita e permitir baixa parcial quando cliente paga em partes.
- Criterios de aceite:
  - Cliente obrigatorio em receita.
  - Baixa parcial reduz saldo e mantem titulo aberto ate quitacao total.

### US-05 Fechar mes
- Como gestor da fazenda, quero fechar o mes financeiro com DRE simplificada e aging.
- Criterios de aceite:
  - Relatorio do periodo trava alteracoes sem permissao de reabertura.
  - Exportacao CSV/XLSX/PDF com filtros aplicados.

---

## 3) Fluxos operacionais (passo a passo)

### 3.1 Cadastrar fornecedor
1. Ir em `Financeiro > Cadastros > Pessoas e empresas`.
2. Clicar `Novo cadastro`.
3. Informar nome/razao social, CPF/CNPJ, contatos e endereco.
4. Marcar tipo `Fornecedor`.
5. Selecionar categoria (ex.: `Pecuaria > Nutricao`) e tags (ex.: `racao`, `mineral`).
6. Salvar.

### 3.2 Lancar despesa
1. Ir em `Financeiro > Lancamentos > Nova despesa`.
2. Preencher emissao, competencia, vencimento.
3. Selecionar fornecedor.
4. Selecionar conta N4 (ex.: `6.2.1.4 - Suplementacao mineral`).
5. Selecionar centro de custo (ex.: `Pecuaria > Recria`).
6. Informar valor e descricao (ex.: `Compra de sal mineral lote fevereiro`).
7. Opcional: anexar nota fiscal.
8. Salvar (fica `open` se sem data de pagamento).

### 3.3 Programar pagamento
1. Ir em `Financeiro > Contas a pagar`.
2. Filtrar por vencimento/proximos 7 dias.
3. Selecionar titulos.
4. Clicar `Programar pagamento` e escolher conta + forma (PIX/TED/boleta).
5. Se valor exigir alcada, enviar para aprovacao.

### 3.4 Baixar pagamento
1. Abrir titulo aprovado em `Contas a pagar`.
2. Informar data de pagamento real e valor pago (com juros/multa/desconto se houver).
3. Confirmar baixa.
4. Sistema muda status para `paid`.
5. Ao conciliar com extrato, status vira `reconciled`.

### 3.5 Lancar receita
1. Ir em `Financeiro > Lancamentos > Nova receita`.
2. Preencher emissao, competencia, vencimento.
3. Selecionar cliente.
4. Selecionar conta N4 de receita (ex.: `1.2.3.1 - Venda de bezerros`).
5. Informar centro de custo/atividade.
6. Salvar.

### 3.6 Baixar recebimento
1. Ir em `Financeiro > Contas a receber`.
2. Abrir titulo.
3. Informar data e valor recebido.
4. Se valor menor que titulo, manter saldo em aberto (`open_partial`).
5. Quitacao total muda para `received`.

### 3.7 Fechamento mensal
1. Ir em `Financeiro > Fechamento`.
2. Selecionar periodo (mes/safra).
3. Validar pendencias: titulos sem centro, sem conta N4, sem conciliacao.
4. Gerar DRE simplificada + fluxo de caixa + aging.
5. Exportar relatorios.
6. Fechar periodo (lock).

---

## 4) Modelo de dados (tabelas e relacionamentos)

### Tabelas principais
- `farms` (fazendas/unidades)
- `people`
  - id, name, document_type, document_number, email, phone, status
- `people_roles`
  - people_id, role (`client`,`supplier`,`carrier`,`owner`,`employee`)
- `supplier_categories`
  - id, name, parent_id
- `supplier_tags`
  - id, name
- `people_supplier_tags`
  - people_id, tag_id
- `chart_of_accounts`
  - id, code, name, level(1-4), parent_id, type(`RECEITA`,`DESPESA`), active
- `cost_centers`
  - id, code, name, parent_id, active
- `bank_accounts`
  - id, farm_id, bank_name, branch, account_number, pix_key, opening_balance, active
- `payment_methods`
  - id, name, fee_percent, term_days, default_bank_account_id, active
- `financial_entries`
  - id, kind(`RECEITA`,`DESPESA`), issue_date, due_date, competence_date, farm_id,
    people_id, account_id(level4), description, total_amount, status, created_by
- `financial_entry_installments`
  - id, entry_id, installment_no, due_date, amount, status, paid_received_amount,
    paid_received_date, interest, penalty, discount
- `financial_entry_allocations`
  - id, installment_id, cost_center_id, allocation_type(`PERCENT`,`VALUE`), allocation_value
- `attachments`
  - id, entity_type, entity_id, file_name, file_url, uploaded_by
- `approvals`
  - id, installment_id, required_level, approved_by, approved_at, status
- `bank_reconciliation`
  - id, bank_account_id, statement_date, statement_amount, matched_installment_id, status
- `audit_logs`
  - id, entity_type, entity_id, action, old_data, new_data, actor_id, created_at

### Relacionamentos chave
- Pessoa 1:N papeis
- Fornecedor N:N tags
- Conta contabil N:1 conta pai (hierarquia)
- Lancamento 1:N parcelas
- Parcela N:N centros de custo (rateio)
- Parcela 1:N aprovacoes (historico)
- Parcela 0:N conciliacoes

---

## 5) Regras de negocio (validacoes e calculos)

1. Receita exige `cliente`.
2. Despesa exige `fornecedor`.
3. Lancamento exige conta `N4` ativa.
4. Sem data de pagamento/recebimento -> status `open`.
5. Parcela vencida sem baixa -> status `overdue`.
6. Baixa parcial permitida em receber (e opcional em pagar).
7. Rateio: soma percentual = 100% ou soma valor = valor da parcela.
8. Conta/centro inativo nao pode receber novos lancamentos.
9. Aprovacao por alcada conforme matriz de perfil x valor.
10. Exclusao logica em dados mestres; fisica apenas por admin tecnico.
11. Toda alteracao financeira gera `audit_log`.
12. DRE considera regime definido (competencia por padrao, caixa opcional no filtro).

### Formulas
- `saldo_parcela = valor_parcela + juros + multa - desconto - recebido_pago`
- `custo_por_cabeca = custo_pecuaria_periodo / cabecas_ativas_periodo`
- `custo_por_hectare = custo_agricola_periodo / hectares_produtivos_periodo`

---

## 6) Wireframe textual das telas

### Tela: Pessoas e empresas
- Cabecalho com busca, filtros de tipo e status.
- Grid principal: Nome, Documento, Tipos, Cidade/UF, Status, Ultima movimentacao.
- Aba lateral do cadastro: Dados gerais, Contato, Endereco, Bancario, Tags fornecedor.

### Tela: Plano de contas
- Arvore N1-N4 com busca por codigo/nome.
- Colunas: Codigo, Conta, Nivel, Tipo, Ativo.
- Acao: visualizar, duplicar estrutura, customizar (se permitido).

### Tela: Lancamentos
- Tabs: `Nova despesa`, `Nova receita`, `Parcelas`.
- Formulario: emissao, competencia, vencimento, pessoa, conta N4, centro/rateio, valor, anexo.
- Card lateral: conferencia (status previsto, impacto no caixa, warnings).

### Tela: Contas a pagar
- Filtros rapidos: hoje, 7 dias, 15 dias, atrasadas.
- Tabela: vencimento, fornecedor, conta N4, centro, valor, saldo, status.
- Acoes em lote: aprovar, programar, pagar, exportar.

### Tela: Contas a receber
- Filtros equivalentes ao AP.
- Acao `Baixa parcial` com historico de recebimentos.

### Tela: Dashboard financeiro
- Cards: caixa atual, AP curto prazo, AR curto prazo, resultado do periodo.
- Graficos: fluxo de caixa, top despesas, receita por atividade, aging.
- Bloco de alertas: estourou orcamento, concentracao em fornecedor, custo anormal.

---

## 7) Relatorios e KPIs

### Relatorios principais
- AP aging por fornecedor e centro.
- AR aging por cliente.
- DRE simplificada mensal/trimestral/semestral.
- Top despesas por categoria N4.
- Despesa por fornecedor (participacao %).
- Fluxo de caixa realizado vs projetado.
- RH: custo pessoal por centro e por atividade.

### KPIs de decisao
- Caixa consolidado e por conta.
- AP 30 dias / AR 30 dias.
- Margem do periodo.
- Custo por cabeca (@ e kg), custo por hectare.
- Ticket medio por fornecedor categoria.
- Inadimplencia (valor e %).

---

## 8) Riscos e pontos criticos

1. Dados incompletos de cadastro (sem documento, sem centro) quebram relatorios.
2. Rateio sem fechamento gera distorcao de custo por atividade.
3. Falta de conciliacao bancaria reduz confianca do dashboard.
4. Mudanca de plano de contas sem governanca gera historico inconsistente.
5. Permissoes frouxas (sem alcada) aumentam risco de pagamento indevido.
6. Baixas retroativas sem log podem mascarar resultado real.

## Recomendacao de implantacao em 4 sprints
1. Sprint 1: cadastros base + plano N4 + centros + pessoas.
2. Sprint 2: lancamentos + parcelas + AP/AR + validacoes.
3. Sprint 3: aprovacao/alcada + conciliacao + auditoria.
4. Sprint 4: dashboard + relatorios + exportacoes + fechamento.

---

## Exemplos reais de uso no dia a dia

- Despesa: `Fornecedor AgroNutri Minas`, categoria `Pecuaria/Nutricao`, conta N4 `6.2.1.4 Suplementacao`, centro `Recria`, valor `R$ 18.450,00`, vencimento em 28 dias.
- Despesa: `Posto Serra Azul`, categoria `Maquinas/Combustivel`, conta N4 `6.4.1.1 Diesel`, centro `Maquinas`, valor `R$ 7.230,00`.
- Receita: `Frigorifico Boi Forte`, conta N4 `1.2.3.1 Venda de boi gordo`, centro `Engorda`, valor `R$ 96.000,00`.
- RH: `Salario vaqueiro`, rateio 70% `Pecuaria`, 30% `Pasto`, com encargos no mesmo centro.

