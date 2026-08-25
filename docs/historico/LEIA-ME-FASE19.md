# FASE 19 — Grupos empresariais, matriz e filiais

## Objetivo
Adicionar uma camada corporativa acima das organizações sem misturar o isolamento operacional dos tenants.

## Novas estruturas
- `sf_corporate_groups`
- `sf_corporate_group_organizations`
- `sf_corporate_group_members`
- `sf_corporate_group_audit`

## Regras
- Um grupo pertence a uma única `sf_billing_accounts`.
- Uma organização só pode pertencer a um grupo.
- Um grupo ativo possui exatamente uma matriz; as demais unidades são filiais.
- Usuários `owner`, `admin` e `analyst` podem ter acesso corporativo.
- Acesso corporativo consolidado NÃO concede acesso operacional a uma filial.
- Para abrir `/admin` de uma unidade, continua sendo obrigatório possuir `sf_memberships` ativo naquela organização.
- RLS segue preparado/desligado até a Fase 24.

## Rotas
- `/admin/grupo`
- `/api/admin/corporate-group`
- `/api/admin/corporate-health`

## Migration
`database/migrations/019_corporate_groups_branches.sql`

Execute após deploy verde:

```bash
node scripts/migrate-multiempresa.mjs
```

## Health
`/api/admin/corporate-health`
