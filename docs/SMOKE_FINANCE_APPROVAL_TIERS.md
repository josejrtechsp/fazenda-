# Smoke Test - Alcada por Faixas

Script de validacao ponta a ponta da alçada financeira por faixas (despesa/receita).

## Execucao

```bash
python3 tools/smoke_finance_approval_tiers.py
```

Com base URL customizada:

```bash
python3 tools/smoke_finance_approval_tiers.py --base http://127.0.0.1:8001
```

## O que o script valida

1. Le politica de aprovacao atual e guarda para restaurar no final.
2. Configura faixas de teste:
   - Despesa: `>= 5.000 => gestor`, `>= 20.000 => admin`
   - Receita: `>= 10.000 => financeiro`
3. Cria 3 lancamentos de QA:
   - despesa baixa (`3.000`)
   - despesa alta (`25.000`)
   - receita alta (`15.000`)
4. Confere regras:
   - despesa baixa: `approved`, sem aprovacao
   - despesa alta: `pending`, aprovador `admin`
   - receita alta: `pending`, aprovador `financeiro`
5. Valida workflow de titulo em contas a pagar:
   - programa data (`scheduled_on`) para a despesa baixa
   - realiza baixa (`pay`)
   - roda prévia de conciliação por CSV (`/finance/reconciliation/preview`)
   - aplica conciliação automática (`/finance/reconciliation/apply`)
   - confirma status de conciliacao `reconciled`
6. Valida trava de perfil na aprovacao:
   - tentativa com perfil errado retorna `403`
   - tentativa com perfil correto aprova e grava `approved_by_role`
7. Restaura a politica original automaticamente (mesmo em erro).
