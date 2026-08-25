# SaborFlow — Correção Fase 25.7.2

## Problema corrigido

O entregador conseguia autenticar, a sessão reconhecia o papel `courier` e `/entregador` abria, mas a tela ainda mostrava:

`Conta ativa, mas perfil de entregador não está operacional`

A reconciliação já havia criado/vinculado o registro em `sf_couriers`. O ponto restante estava no limite SSR/RLS: a consulta do perfil operacional dependia do contexto RLS herdado da verificação da sessão. Nesta correção, a página e a camada de expedição entram explicitamente no tenant RLS antes de consultar `sf_couriers` e pedidos.

## Arquivos funcionais

- `app/entregador/page.tsx`
- `lib/delivery-dispatch-db.ts`
- `app/api/admin/delivery-dispatch-health/route.ts`

## Migration

Não existe migration nova nesta correção.

## Build no terminal PowerShell do VS Code

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git status --short
```

Stage somente dos arquivos desta correção:

```powershell
git add -- `
"app/entregador/page.tsx" `
"lib/delivery-dispatch-db.ts" `
"app/api/admin/delivery-dispatch-health/route.ts"
```

Validação:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
```

Commit e push:

```powershell
git commit -m "Corrigir escopo RLS do perfil do entregador"
git push origin main
```

## Teste depois do Railway SUCCESS

1. Abra uma janela anônima.
2. Faça login com o entregador.
3. Acesse `/entregador`.
4. O cartão de alerta de perfil não operacional deve desaparecer.
5. Deve aparecer o cartão de perfil vinculado do entregador, mesmo que não haja pedidos atribuídos.

Também valide, autenticado como administrador:

`/api/admin/delivery-dispatch-health`

O campo `phase` deve ser:

`25.7.2-courier-rls-session-scope`

E as capacidades devem conter:

- `courierLookupUsesExplicitTenantRlsScope: true`
- `courierPageUsesExplicitTenantRlsScope: true`

Se o alerta ainda aparecer, execute dentro do Railway:

```powershell
railway ssh -s crissalgadosteste -- node scripts/reconcile-courier-logins.mjs
```

A segunda execução para um vínculo já corrigido deve resultar em `ok` para esse e-mail, e não criar outro perfil.
