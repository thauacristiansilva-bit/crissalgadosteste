# SaborFlow — Fase 2: núcleo multiempresa

A Fase 1 confirmou a conexão PostgreSQL.

Agora esta etapa cria somente o **núcleo do SaaS multiempresa**:

- `sf_users`
- `sf_organizations`
- `sf_memberships`
- `sf_organization_settings`
- `sf_audit_log`
- `sf_schema_migrations`

## O que NÃO acontece nesta fase

- `store.json` NÃO é removido.
- produtos/pedidos/clientes NÃO são migrados.
- o login atual NÃO é substituído.
- nenhuma empresa é cadastrada automaticamente.
- Google/CPF/CNPJ login ainda NÃO é ativado.

Isto permite criar a fundação sem interromper a aplicação atual.

## 1. Copiar os arquivos

Copie estas pastas para a raiz do projeto:

- `database/`
- `scripts/`
- `app/api/admin/database-structure/`

## 2. Build local

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

## 3. Commit e push

```powershell
git add database
git add scripts/migrate-multiempresa.mjs
git add app/api/admin/database-structure/route.ts

git commit -m "Criar nucleo multiempresa PostgreSQL SaborFlow"
git push origin main
```

Espere o Railway ficar SUCCESS.

## 4. Executar migration

A migration precisa rodar com o `DATABASE_URL` do Railway.

No Railway, abra o serviço `crissalgadosteste` -> `Console` e execute:

```bash
node scripts/migrate-multiempresa.mjs
```

Resultado esperado:

```text
PostgreSQL conectado.
APLICANDO 001_core_multiempresa...
OK 001_core_multiempresa

Estrutura SaborFlow encontrada:
- sf_audit_log
- sf_memberships
- sf_organization_settings
- sf_organizations
- sf_schema_migrations
- sf_users
```

Se executar de novo, é seguro: a migration será ignorada como já aplicada.

## 5. Conferir pela aplicação

Logado no Admin, abra:

`/api/admin/database-structure`

Resultado esperado:

```json
{
  "ok": true,
  "missing": []
}
```

## Próxima fase

Depois disso criaremos:

1. a primeira organização (Cris Salgados);
2. vínculo do administrador como `owner`;
3. sessão com `organizationId`;
4. seletor de empresa;
5. autorização por papel;
6. somente depois, login CPF/CNPJ/Google.
