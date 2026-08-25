# SaborFlow — Fase 6: Clientes e Contas Multiempresa

A Fase 6 separa as contas de consumidor por `organization_id`.

## PostgreSQL

Cria:

- `sf_customer_accounts`
- `sf_customers_state`

A tela CRM de clientes passa a combinar:

- histórico de pedidos da organização em `sf_orders`;
- contas CPF/PIN da mesma organização em `sf_customer_accounts`.

Assim, pedidos de uma empresa e contas de outra empresa não entram no mesmo
painel.

## CPF

O SaborFlow NÃO copia CPF puro para o PostgreSQL nesta fase.

A migração preserva:

- `cpf_hash`
- últimos 4 dígitos

Isso mantém o login existente funcionando sem armazenar o documento em texto
puro.

O campo `google_subject` já existe para a futura autenticação Google, porém
Google Login NÃO é ativado nesta fase.

## Cookie do consumidor

O cookie novo é:

`saborflow_client_session`

Ele contém, de forma assinada:

- `organizationId`
- `accountId`
- expiração

Assim, um ID de conta sozinho não é suficiente para trocar de empresa.

O cookie antigo `cris_client_session` é aceito apenas como compatibilidade de
transição e é removido no próximo login/cadastro.

## Ponte temporária

O `store.json` continua existindo.

Para a empresa atual:

- cadastro no PostgreSQL também é espelhado no legado;
- atualização de perfil também é espelhada;
- pontos ganhos no pedido são sincronizados de volta ao PostgreSQL.

Isso é necessário porque o cálculo de fidelidade do checkout ainda passa pelo
fluxo legado.

---

## 1. Instalar

Copie o conteúdo do ZIP para a raiz do projeto.

## 2. Build local

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se falhar, NÃO faça commit.

## 3. Git

```powershell
git add database/migrations/005_customers_multiempresa.sql
git add scripts/import-customers-multiempresa.mjs
git add lib/customer-db.ts
git add lib/client-auth.ts
git add lib/db.ts
git add lib/tenant-admin-data.ts
git add app/api/admin/customers/route.ts
git add app/api/admin/customers-health/route.ts
git add app/api/client/login/route.ts
git add app/api/client/register/route.ts
git add app/api/client/me/route.ts
git add app/api/client/profile/route.ts
git add app/api/client/logout/route.ts

git status
git commit -m "Migrar clientes e contas para PostgreSQL multiempresa SaborFlow"
git push origin main
```

Espere o Railway ficar `SUCCESS`.

## 4. Migration 005

No Console Railway:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
SKIP 001_core_multiempresa - já aplicada
SKIP 002_organization_onboarding - já aplicada
SKIP 003_catalog_multiempresa - já aplicada
SKIP 004_orders_multiempresa - já aplicada
APLICANDO 005_customers_multiempresa...
OK 005_customers_multiempresa
```

## 5. Importar contas atuais

```bash
node scripts/import-customers-multiempresa.mjs
```

Não use `--force`.

Resultado esperado:

```text
SaborFlow - clientes/contas multiempresa importados com sucesso.
Empresa: Cris Salgados
Organization ID: ...
Contas com CPF/PIN: ...
Origem: ...
CPF puro não foi copiado.
store.json não foi apagado nem alterado.
```

### Origem store.seed.json

Se aparecer `/app/data/store.seed.json` e você esperava contas de clientes
reais já cadastradas anteriormente, pare e confira o Volume/DATA_FILE antes de
continuar.

Se nunca havia contas CPF/PIN cadastradas, quantidade 0 é válida.

## 6. Health check

Logado no Admin:

`https://crissalgadosteste-production.up.railway.app/api/admin/customers-health`

Esperado:

```json
{
  "ok": true,
  "customers": {
    "ready": true
  },
  "transition": {
    "legacyMirrorEnabled": true,
    "countsMatch": true
  }
}
```

## 7. Teste de conta real

Somente depois de `ok: true`:

1. no site público, abra **Entrar**;
2. se já tiver uma conta, saia e faça login novamente;
3. se não tiver, cadastre uma conta de teste com CPF válido e PIN;
4. abra `/api/client/me`;
5. confirme `sessionMode: "tenant"`;
6. altere nome/endereço no perfil;
7. faça um pedido pequeno logado;
8. confirme que os pontos, se a fidelidade estiver ativa, continuam corretos;
9. abra novamente `/api/admin/customers-health`.

O resultado deve continuar:

```json
"countsMatch": true
```

## Não fazer

- não apagar `data/store.json`;
- não usar `--force`;
- não armazenar CPF puro manualmente no banco;
- não ativar Google OAuth ainda;
- não criar contas diretamente pelo editor de tabelas do Railway.

## Limite atual importante

O armazenamento já é multiempresa, porém o storefront público ainda representa
a empresa atual do deployment. A resolução pública por `slug`/domínio será uma
fase separada antes de colocar várias empresas atendendo clientes pelo mesmo
deployment.

## Próxima fase

A Fase 7 deve migrar os próximos módulos de negócio que ainda dependem do
arquivo legado, com prioridade para:

- cupons;
- feedbacks/avaliações;
- caixa/financeiro;
- delivery zones/couriers;

antes da remoção definitiva do `store.json`.
