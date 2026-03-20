# MVP-S1 - Plano tecnico por arquivo (Financeiro)

Data: 2026-03-01
Escopo: Sprint MVP-S1 (cadastros base financeiros)

## 1) Estado atual confirmado no codigo

### Backend ja existente
- Plano de contas N1-N4:
  - Model: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/accounting.py`
  - Router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/accounts.py`
- Pessoas multi-tipo (cliente/fornecedor/colaborador/transportadora/proprietario):
  - Model: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/people.py`
  - Router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/people.py`
- Lancamentos financeiros em eventos (payload):
  - Router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/events.py`

### Frontend ja existente
- Tela principal financeiro:
  - `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/frontend/src/pages/Financeiro.jsx`
- Tela de cadastros financeiros (contas + pessoas):
  - `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/frontend/src/pages/FinanceiroCadastros.jsx`

## 2) Gap de MVP-S1

1. Fornecedor ainda nao tem categoria estruturada e tags de produto/servico.
2. Cadastro de pessoas nao possui dados bancarios estruturados.
3. Nao existe cadastro dedicado de centro de custo.
4. Nao existe cadastro dedicado de contas bancarias/caixas.
5. Nao existe cadastro dedicado de formas de pagamento/recebimento.
6. Validacao de CPF/CNPJ ainda nao cobre padrao + unicidade consistente para producao.

## 3) Backlog tecnico executavel (ordem recomendada)

## Fase A - Banco e modelos (base)

### A1 - Expandir modelo de pessoas
- Arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/people.py`
- Mudancas:
  - Adicionar campos:
    - `document_type` (CPF|CNPJ|OUTRO)
    - `zip_code`, `street`, `number`, `district`, `city`, `state`
    - `bank_name`, `bank_branch`, `bank_account`, `pix_key`, `pix_type`
    - `supplier_category_id` (FK logica)
    - `supplier_tags_csv` (MVP rapido) ou relacao N:N (preferivel)
- Criterio:
  - API continua retrocompativel com campos atuais.

### A2 - Criar categorias de fornecedor
- Novo arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/supplier_catalog.py`
- Tabelas:
  - `supplier_categories(id, name, parent_id, is_active, created_at, updated_at)`
  - `supplier_tags(id, name, is_active, created_at, updated_at)`
  - `supplier_tag_links(id, person_id, tag_id)`
- Criterio:
  - Fornecedor pode ter 1 categoria principal e varias tags.

### A3 - Criar centros de custo
- Novo arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/cost_center.py`
- Tabela:
  - `cost_centers(id, code, name, parent_id, is_active, created_at, updated_at)`
- Criterio:
  - Centro pode ser hierarquico (pai/filho) desde o MVP.

### A4 - Criar contas bancarias
- Novo arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/banking.py`
- Tabela:
  - `bank_accounts(id, name, bank_name, branch, account_number, account_type, opening_balance, is_active, created_at, updated_at)`
- Criterio:
  - Suporta multiplas contas.

### A5 - Criar formas de pagamento
- Novo arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/models/payment_method.py`
- Tabela:
  - `payment_methods(id, name, method_type, fee_percent, term_days, default_bank_account_id, is_active, created_at, updated_at)`
- Criterio:
  - PIX, boleto, transferencia, dinheiro, cartao, barter.

## Fase B - Routers e regras

### B1 - Endpoints de categorias/tags de fornecedor
- Novo router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/supplier_catalog.py`
- Endpoints:
  - `GET /supplier-categories`
  - `POST /supplier-categories`
  - `PATCH /supplier-categories/{id}`
  - `GET /supplier-tags`
  - `POST /supplier-tags`
- Regra:
  - Nao excluir fisico se em uso.

### B2 - Evoluir `people.py`
- Arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/people.py`
- Mudancas:
  - Validar documento por tipo (CPF/CNPJ) + unicidade.
  - Aceitar categoria/tags de fornecedor.
  - Aceitar dados bancarios.
  - Incluir filtros: `role`, `supplier_category_id`, `city`, `state`, `active`.

### B3 - Endpoints de centro de custo
- Novo router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/cost_centers.py`
- Endpoints:
  - `GET /cost-centers`
  - `POST /cost-centers`
  - `PATCH /cost-centers/{id}`

### B4 - Endpoints de contas bancarias
- Novo router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/bank_accounts.py`
- Endpoints:
  - `GET /bank-accounts`
  - `POST /bank-accounts`
  - `PATCH /bank-accounts/{id}`

### B5 - Endpoints de formas de pagamento
- Novo router: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/routers/payment_methods.py`
- Endpoints:
  - `GET /payment-methods`
  - `POST /payment-methods`
  - `PATCH /payment-methods/{id}`

### B6 - Registrar routers no app
- Arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/backend/app/main.py`
- Acao:
  - `app.include_router(...)` para os novos routers.

## Fase C - Frontend (cadastros)

### C1 - Expandir tela `FinanceiroCadastros.jsx`
- Arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/frontend/src/pages/FinanceiroCadastros.jsx`
- Mudancas:
  - Nova secao: `Categorias e tags de fornecedor`
  - Nova secao: `Centros de custo`
  - Nova secao: `Contas bancarias`
  - Nova secao: `Formas de pagamento`
  - Form de pessoa com dados bancarios e categoria/tags.

### C2 - Atualizar estilos
- Arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/frontend/src/styles/financeiro_cadastros.css`
- Mudancas:
  - Grid responsivo para 4 blocos de cadastro.
  - Padrao visual consistente com sistema atual.

### C3 - API client
- Arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/frontend/src/lib/api.js`
- Acao:
  - Sem mudanca estrutural; apenas novos caminhos consumidos na pagina.

## Fase D - Qualidade e validacao

### D1 - Script de verificacao rapida
- Novo arquivo: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/tools/verify_financeiro_mvp_s1.sh`
- Verificacoes:
  - health API
  - seed contas
  - CRUD pessoa fornecedor com categoria/tag
  - CRUD centro de custo
  - CRUD conta bancaria
  - CRUD forma pagamento

### D2 - Cenarios reais de teste
- Arquivo de roteiro: `/Users/antoniojunior/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE/SOFTWARE FAZENDA/IDEAL_FAZENDA/docs/financeiro/CENARIOS_TESTE_MVP_S1.md`
- Cenarios:
  - Fertilizante (fornecedor insumo)
  - Frete de boi (fornecedor servico)
  - Salario colaborador (pessoa funcionario)

## 4) Contratos minimos de API para fechar S1

## POST /people (novo payload esperado)
```json
{
  "name": "Agro Nutri Minas",
  "document_type": "CNPJ",
  "document": "12345678000190",
  "phone": "38999990000",
  "email": "financeiro@agronutri.com",
  "city": "Januaria",
  "state": "MG",
  "is_supplier": true,
  "supplier_category_id": 3,
  "supplier_tag_ids": [1, 4, 7],
  "bank_name": "Sicoob",
  "bank_branch": "0123",
  "bank_account": "45678-9",
  "pix_key": "financeiro@agronutri.com",
  "pix_type": "EMAIL",
  "is_active": true
}
```

## POST /cost-centers
```json
{ "code": "PEC-RECRIA", "name": "Pecuaria - Recria", "parent_id": null, "is_active": true }
```

## POST /bank-accounts
```json
{ "name": "Conta principal", "bank_name": "Banco do Brasil", "branch": "1111", "account_number": "12345-6", "account_type": "CORRENTE", "opening_balance": 50000, "is_active": true }
```

## POST /payment-methods
```json
{ "name": "PIX", "method_type": "PIX", "fee_percent": 0, "term_days": 0, "default_bank_account_id": 1, "is_active": true }
```

## 5) Definicao de pronto MVP-S1

1. Cadastros base disponiveis em unica tela operacional de financeiro.
2. Fornecedor classificado por categoria e tags.
3. Documento validado e sem duplicidade ativa.
4. Centro de custo, conta bancaria e forma de pagamento com CRUD funcional.
5. Build frontend sem erro e API backend sem erro 500 nesses cadastros.
6. Script de verificacao MVP-S1 passando.

## 6) Estimativa objetiva

- Banco/modelos: 1.5 dias
- Routers/regras: 2 dias
- Frontend cadastros: 2 dias
- Testes + ajustes: 1 dia
- Total: 6.5 dias uteis
