# SaborFlow — FASE 25.7

## Histórico de lançamentos financeiros

Esta fase adiciona ao painel financeiro um histórico real dos lançamentos já persistidos em PostgreSQL (`sf_financial_entries`).

### O que foi adicionado

- tabela **Histórico de lançamentos**;
- ordenação do mais recente para o mais antigo;
- data e hora do lançamento;
- tipo: **Despesa** ou **Outra receita**;
- categoria;
- descrição;
- valor com sinal visual de entrada/saída;
- filtro por tipo;
- busca por descrição ou categoria;
- contador de resultados;
- exportação dos lançamentos filtrados em CSV;
- um lançamento novo aparece no histórico imediatamente após salvar, sem recarregar a página.

Não há migration nesta fase. O histórico usa os lançamentos que já existem em PostgreSQL.

## Aplicação no projeto

Extraia este ZIP diretamente na raiz do projeto.

No terminal PowerShell do VS Code:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar:

```powershell
git status --short
```

Faça stage somente do arquivo desta fase:

```powershell
git add -- `
"components/admin/sales-panel.tsx"
```

Valide:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
```

Depois:

```powershell
git commit -m "Adicionar historico de lancamentos financeiros"
git push origin main
```

**Não rode migration nesta fase.**

## Teste depois do Railway SUCCESS

1. Entre no Admin.
2. Abra Vendas/Financeiro.
3. Cadastre uma despesa de teste.
4. Confirme que aparece a mensagem de sucesso.
5. Role até **Histórico de lançamentos**.
6. Confirme data, tipo, categoria, descrição e valor.
7. Recarregue a página e confirme que o lançamento continua aparecendo.
8. Teste os filtros **Despesas**, **Outras receitas** e **Todos os tipos**.
9. Teste a busca por descrição/categoria.
10. Teste **Exportar lançamentos**.

