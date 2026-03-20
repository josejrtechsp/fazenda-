# Cenarios de teste funcional - MVP-S1 Financeiro

## Objetivo
Validar se os cadastros base do financeiro estao prontos para uso diario.

## Pre-condicoes
1. Backend ativo (`/health` respondendo 200).
2. Frontend ativo e acessivel.
3. Seed do plano de contas atualizada.

## Cenario 1 - Fornecedor de nutricao

### Passos
1. Abrir `Custos e Receitas -> Lancamentos -> Pessoas e empresas`.
2. Cadastrar pessoa:
   - Nome: `Agro Nutri Minas`
   - Tipo: `Fornecedor`
   - Documento: CNPJ valido
   - Categoria: `Pecuaria > Nutricao`
   - Tags: `sal mineral`, `suplemento`
   - PIX: email financeiro
3. Salvar.

### Resultado esperado
- Cadastro salvo sem erro.
- Fornecedor aparece na lista com tipo `Fornecedor`.
- Categoria e tags aparecem no detalhe da pessoa.

## Cenario 2 - Fornecedor de frete

### Passos
1. Cadastrar pessoa:
   - Nome: `Transportes Serra Azul`
   - Tipo: `Fornecedor` + `Transportadora`
   - Categoria: `Servicos agricolas`
   - Tag: `frete boi`
2. Salvar.

### Resultado esperado
- Multi-tipo permitido no mesmo cadastro.
- Pessoa aparece filtrando por `Fornecedor` e por `Transportadora`.

## Cenario 3 - Colaborador com dados bancarios

### Passos
1. Cadastrar pessoa:
   - Nome: `Joao Vaqueiro`
   - Tipo: `Colaborador`
   - Documento: CPF valido
   - Banco/agencia/conta preenchidos
2. Salvar.

### Resultado esperado
- Cadastro salvo com dados bancarios.
- Documento invalido deve gerar erro 422 com mensagem clara.

## Cenario 4 - Centro de custo

### Passos
1. Abrir bloco `Centros de custo`.
2. Criar:
   - `PEC-CRIA` (Pecuaria - Cria)
   - `PEC-RECRIA` (Pecuaria - Recria)
   - `AGRI-SOJA` (Agricultura - Soja)
3. Listar e filtrar.

### Resultado esperado
- Centros ativos visiveis no cadastro.
- Codigo duplicado deve ser bloqueado.

## Cenario 5 - Conta bancaria

### Passos
1. Abrir bloco `Contas bancarias`.
2. Criar conta:
   - Nome: `Conta principal`
   - Banco: `Banco do Brasil`
   - Saldo inicial: `50000`
3. Salvar.

### Resultado esperado
- Conta aparece na lista.
- Pode ser marcada como inativa sem excluir historico.

## Cenario 6 - Forma de pagamento

### Passos
1. Abrir bloco `Formas de pagamento`.
2. Cadastrar:
   - PIX (taxa 0, prazo 0)
   - Boleto (taxa 0, prazo 2)
   - Cartao (taxa 2.5, prazo 30)
3. Salvar.

### Resultado esperado
- Formas aparecem na lista e podem ser editadas.
- Conta padrao opcional pode ser vinculada.

## Cenario 7 - Consistencia minima para seguir ao S2

### Passos
1. Entrar em `Lancamentos`.
2. Verificar se lista de fornecedores, contas N4 e centros de custo estao disponiveis.

### Resultado esperado
- Base de cadastro suficiente para comecar lancamentos de despesa e receita no Sprint S2.
