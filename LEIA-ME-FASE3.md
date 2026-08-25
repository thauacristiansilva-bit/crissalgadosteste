# SaborFlow — Fase 3: primeira empresa + sessão multiempresa

Esta etapa transforma a autenticação administrativa atual em uma ponte segura para o modelo multiempresa.

## O que muda

1. Cria a primeira organização usando os dados atuais da loja.
2. Cria o usuário administrador atual no PostgreSQL.
3. Vincula esse usuário à organização como `owner`.
4. Copia as configurações atuais da loja para `sf_organization_settings`.
5. Cria uma sessão assinada contendo:
   - `userId`
   - `organizationId`
   - `organizationName`
   - `organizationSlug`
   - `role`
6. Mantém compatibilidade com o login legado durante a transição.

## Importante

O CPF/CNPJ da primeira empresa NÃO é inventado.

A organização é criada com `onboarding_status = pending`.
Na fase de onboarding vamos pedir o CPF/CNPJ real e concluir o cadastro.

## Instalação

Copie o conteúdo do ZIP para a raiz do projeto.

Depois:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar:

```powershell
git add database/migrations/002_organization_onboarding.sql
git add scripts/bootstrap-first-organization.mjs
git add lib/auth.ts
git add lib/tenant-context.ts
git add app/api/auth/login/route.ts
git add app/api/auth/logout/route.ts
git add app/api/admin/tenant-context/route.ts
git add app/admin/page.tsx

git commit -m "Adicionar primeira empresa e sessao multiempresa SaborFlow"
git push origin main
```

Espere o Railway ficar SUCCESS.

## No Railway: aplicar migration 002

No Console do serviço `crissalgadosteste`:

```bash
node scripts/migrate-multiempresa.mjs
```

Deve aparecer algo parecido com:

```text
APLICANDO 002_organization_onboarding...
OK 002_organization_onboarding
```

## No Railway: criar a primeira organização

Ainda no Console:

```bash
node scripts/bootstrap-first-organization.mjs
```

O script usa:

- `DATABASE_URL`
- `ADMIN_EMAIL`
- `DATA_FILE` (quando disponível)
- `data/store.seed.json` como fallback

Ele NÃO imprime senha nem DATABASE_URL.

## Gerar a nova sessão

Depois do bootstrap:

1. abra o Admin;
2. clique em **Sair**;
3. faça login novamente.

O novo cookie será:

`saborflow_admin_session`

O cookie antigo `cris_admin_session` é removido no novo login.

## Verificação

Logado no Admin, abra:

`/api/admin/tenant-context`

O resultado esperado:

```json
{
  "ok": true,
  "sessionMode": "tenant",
  "user": {
    "email": "...",
    "role": "owner"
  },
  "organization": {
    "name": "Cris Salgados",
    "slug": "cris-salgados"
  },
  "activeMembership": true
}
```

## O que ainda NÃO foi migrado

- produtos
- categorias
- pedidos
- clientes
- caixa
- financeiro
- delivery zones

Eles continuam usando o `store.json`.

A próxima fase adicionará `organization_id` às tabelas operacionais no PostgreSQL e começará a migrar o catálogo primeiro.
