# SaborFlow — Fase 8.2 — Correção de tipagem do public store

Corrige os erros TypeScript:

- TS7034 em `products`
- TS7034 em `categories`
- TS7034 em `deliveryZones`
- TS7005 nos mesmos arrays

A correção usa os próprios tipos de retorno das funções PostgreSQL:

`Awaited<ReturnType<typeof ...>>`

Assim não cria tipos duplicados e continua acompanhando os tipos reais do projeto.

## Aplicar

Substitua somente:

`lib/public-store-db.ts`

Depois:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git add lib/public-store-db.ts
git commit -m "Corrigir tipagem da loja publica da Fase 8"
git push origin main
```

Os avisos de filesystem do Turbopack continuam sendo warnings e não são a causa deste erro.
