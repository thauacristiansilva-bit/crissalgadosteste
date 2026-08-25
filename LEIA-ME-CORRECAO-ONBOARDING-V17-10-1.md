# SaborFlow — Correção v17.10.1 — cadastro de nova empresa

Corrige o erro PostgreSQL:

`inconsistent types deduced for parameter $2`

## Causa

Na gravação do `sf_audit_log`, o mesmo parâmetro `$2` era usado como:

- `organization_id` → UUID
- `entity_id` → texto através de `$2::text`

O PostgreSQL tentava inferir dois tipos diferentes para o mesmo parâmetro.

## Correção

Foi alterado:

```sql
$2::text
```

para:

```sql
$2::uuid::text
```

Assim o parâmetro é inferido como UUID em todos os usos e convertido para texto
somente no valor gravado em `entity_id`.

A transação de onboarding já executa `ROLLBACK` quando ocorre erro, portanto a
tentativa que falhou não deve ter deixado uma empresa parcialmente cadastrada.

## Aplicar

Substitua somente:

`lib/organization-onboarding.ts`

Depois:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git add lib/organization-onboarding.ts
git commit -m "Corrigir cadastro de nova empresa no PostgreSQL"
git push origin main
```

Após o Railway ficar `SUCCESS`, tente novamente cadastrar a nova empresa.

Não é necessário rodar uma nova migration para esta correção.
