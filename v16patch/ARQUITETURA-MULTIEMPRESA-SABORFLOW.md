# SaborFlow — arquitetura multiempresa

## Objetivo
O login público deve exibir somente a Plataforma SaborFlow. Dados de uma empresa só aparecem depois que o usuário autenticado entra no ambiente correspondente.

## Modelo recomendado
- `users`: pessoa que acessa o sistema.
- `organizations`: empresa/tenant identificada por CPF ou CNPJ conforme o cadastro.
- `memberships`: vínculo entre usuário e empresa, com função/permissões.
- `sessions`: sessão autenticada com `userId` e `organizationId`.
- Todas as tabelas operacionais (produtos, pedidos, clientes, caixa, estoque etc.) devem carregar `organizationId`.

## Login
Campo único: e-mail, CPF ou CNPJ + senha.
Também: Entrar com Google.

## Cadastro
- Pessoa física: CPF, nome, e-mail, celular e senha.
- Pessoa jurídica: CNPJ, razão/nome da empresa, responsável, CPF do responsável, e-mail, celular e senha.
- Google: autentica a pessoa; no primeiro acesso, o onboarding coleta CPF/CNPJ e cria ou vincula a empresa.

## Isolamento
Nenhuma consulta pode retornar registros sem filtrar pelo `organizationId` da sessão. Um usuário que participa de mais de uma empresa escolhe qual ambiente abrir.

## Banco
Para venda como SaaS, migrar o armazenamento atual em JSON para PostgreSQL antes de liberar múltiplos clientes.
