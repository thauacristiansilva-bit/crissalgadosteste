# FASE 18 — Superadmin SaborFlow

## Objetivo
Control plane separado do painel operacional dos clientes. Um usuário comum, mesmo `owner` de uma loja, não recebe acesso automaticamente.

## Banco
Migration: `database/migrations/017_superadmin_control_plane.sql`

Cria:
- `sf_platform_admins`
- `sf_commercial_coupons`
- `sf_support_cases`
- `sf_platform_admin_actions`

## Segurança
- exige sessão PostgreSQL `tenant`; sessão legacy não entra;
- exige registro ativo em `sf_platform_admins`;
- não existe endpoint para o navegador conceder Superadmin;
- mutações usam validação same-origin;
- toda mutação administrativa é registrada em `sf_platform_admin_actions`;
- ações de plano não alteram o status de pagamento confirmado pelo provider; apenas o plano vinculado e overrides explícitos.

## Instalação
Após extrair na raiz:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Depois confira `git status --short` antes do stage.

## Após deploy + migration 017
No console do Railway:

```bash
node scripts/migrate-multiempresa.mjs
node scripts/grant-superadmin.mjs
```

O segundo comando usa `SUPERADMIN_EMAIL` ou `ADMIN_EMAIL`. Também pode ser explícito:

```bash
node scripts/grant-superadmin.mjs seu-email@dominio.com owner
```

Nunca coloque a lista de Superadmins em código cliente.

## Testes
- `/superadmin`
- `/api/superadmin/health`
- `/api/admin/billing-health`
