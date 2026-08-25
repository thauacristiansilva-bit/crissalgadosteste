# SaborFlow — Fase 9: Onboarding, seletor e checkout multiempresa

A Fase 9 é a primeira fase em que uma segunda empresa pode ser criada pelo
próprio painel sem editar tabelas manualmente.

## O que entra

### 1. Login administrativo no PostgreSQL

`sf_users.password_hash` passa a ser utilizado pelo login.

A migration 008 adiciona:

- `password_updated_at`
- `last_login_at`
- `created_by_user_id` em organizações
- `onboarding_version`

A senha é armazenada com `scrypt` + salt aleatório.

Nenhuma senha pura é gravada no PostgreSQL.

### 2. Múltiplas empresas por usuário

Um usuário pode ter várias `sf_memberships`.

O painel ganha:

- seletor de empresa;
- botão `Nova empresa`;
- troca segura de organização;
- sessão reemitida após a troca.

O servidor valida a membership. O navegador nunca escolhe um
`organization_id` sem validação.

Para empresas diferentes da empresa original do deployment, o Admin passa a
ser `fail closed`: se um módulo PostgreSQL não estiver pronto, o painel retorna
erro em vez de cair no `store.json` da Cris Salgados.

Os endpoints administrativos centrais de pedidos, atualização de pedido e PDF
também falham fechados para uma empresa secundária se o PostgreSQL daquele
tenant não estiver pronto.

### 3. Onboarding real

Nova página:

`/admin/nova-empresa`

O formulário coleta:

- PF/PJ;
- CPF/CNPJ da empresa;
- nome;
- razão social;
- segmento;
- telefone/e-mail;
- cidade/UF.

CPF/CNPJ são validados no servidor.

A nova empresa nasce com todas as tabelas operacionais vazias e isoladas, já
marcadas como `ready`.

Não são copiados produtos, clientes, configurações ou pedidos da Cris Salgados.

### 4. Checkout PostgreSQL multiempresa

O checkout público passa a criar o pedido diretamente em:

- `sf_orders`
- `sf_order_items`

e atualiza estoque diretamente em `sf_products`.

Se o cliente estiver autenticado, os pontos de fidelidade são atualizados na
conta da MESMA organização.

Preço, estoque, cupom, empresa, taxa e conta de cliente são derivados ou
validados no servidor.

Sessões antigas de cliente, que não possuíam `organization_id`, passam a ser
aceitas somente na empresa original do deployment; isso evita que um cookie
legado seja reutilizado em outra organização com o mesmo ID numérico de cliente.

Para a empresa atual do deployment, o pedido continua temporariamente refletido
em `/data/store.json`, somente para compatibilidade com partes legadas.

Uma segunda empresa NÃO grava no `store.json`.

Carrinho e acompanhamento também passam a ser isolados pelo `slug` da loja.
O carrinho usa uma chave de `localStorage` por empresa e o link de acompanhamento
da segunda empresa usa `/loja/<slug>/pedido/<referencia>`.

### 5. PDV multiempresa

Pedidos do PDV também passam a ser criados diretamente no PostgreSQL da empresa
ativa.

### 6. Publicação controlada

Toda nova empresa nasce com:

`public_store_enabled = true`

e:

`public_ordering_enabled = false`

No seletor do painel existe o botão `Ativar`.

Para ativar pedidos online, o servidor exige:

- runtime pronto;
- catálogo pronto;
- pedidos prontos;
- operação pronta;
- clientes prontos;
- pelo menos um produto ativo;
- retirada ou entrega ativa;
- `Aceitar pedidos` ligado nas configurações.

---

## INSTALAÇÃO

### 1. Copiar a Fase 9

Extraia este ZIP na raiz do projeto e substitua os arquivos.

### 2. Build local

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se falhar, NÃO faça commit.

### 3. Git

```powershell
git add database/migrations/008_admin_auth_onboarding_checkout.sql
git add scripts/migrate-admin-login-to-postgres.mjs
git add lib/admin-user-db.ts
git add lib/auth.ts
git add lib/client-auth.ts
git add lib/tenant-context.ts
git add lib/tenant-access.ts
git add lib/organization-onboarding.ts
git add lib/tenant-checkout.ts
git add lib/tenant-admin-data.ts
git add components/admin/organization-switcher.tsx
git add components/admin/organization-onboarding-form.tsx
git add components/admin/admin-dashboard.tsx
git add components/store/storefront.tsx
git add proxy.ts
git add app/loja/[slug]/pedido/[reference]/page.tsx
git add app/admin/nova-empresa/page.tsx
git add app/minha-loja/route.ts
git add app/api/auth/login/route.ts
git add app/api/admin/organizations/route.ts
git add app/api/admin/organizations/current/ordering/route.ts
git add app/api/admin/switch-organization/route.ts
git add app/api/admin/multiempresa-health/route.ts
git add app/api/admin/tenant-context/route.ts
git add app/api/admin/pdv-order/route.ts
git add app/api/orders/route.ts
git add app/api/orders/[id]/route.ts
git add app/api/orders/[id]/ticket-pdf/route.ts
git add app/api/client/register/route.ts

git status
```

Se `next-env.d.ts` aparecer modificado:

```powershell
git restore next-env.d.ts
```

Não use `git add .`.

Depois:

```powershell
git commit -m "Adicionar onboarding e checkout multiempresa SaborFlow"
git push origin main
```

Espere o Railway ficar `SUCCESS`.

---

## 4. Migration 008

No Console do serviço da aplicação:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado no final:

```text
APLICANDO 008_admin_auth_onboarding_checkout...
OK 008_admin_auth_onboarding_checkout
```

---

## 5. Promover o login administrativo ao PostgreSQL

Antes, confirme que `ADMIN_PASSWORD` no Railway é a senha administrativa que
você usa atualmente e que ela possui pelo menos 8 caracteres.

Depois:

```bash
node scripts/migrate-admin-login-to-postgres.mjs
```

Esperado:

```text
SaborFlow - login administrativo promovido ao PostgreSQL com sucesso.
Usuário: ...
A senha não foi exibida.
```

Não use `--force`.

Faça logout do Admin e entre novamente com a mesma senha.

---

## 6. Health da Fase 9

Logado:

`/api/admin/multiempresa-health`

Queremos:

```json
{
  "ok": true,
  "auth": {
    "databasePasswordReady": true
  },
  "organizations": {
    "count": 1
  }
}
```

O `checkout.ready` pode depender de produto/aceitação da empresa ativa, mas os
estados PostgreSQL precisam estar `true`.

### ADMIN_LOGIN_MODE

Após confirmar que:

- login PostgreSQL funciona;
- `databasePasswordReady` é `true`;
- `SESSION_SECRET` está configurado;

você pode adicionar no Railway:

```text
ADMIN_LOGIN_MODE=postgres
```

Com isso o login deixa de aceitar a autenticação legada por
`ADMIN_EMAIL`/`ADMIN_PASSWORD` como fallback.

NÃO apague `ADMIN_PASSWORD` ainda nesta fase.

---

## 7. Criar a segunda empresa

No painel:

`Empresa ativa → Nova empresa`

ou:

`/admin/nova-empresa`

Use os dados REAIS da segunda empresa.

Não invente CPF/CNPJ para teste em produção.

Depois de criar, a sessão muda automaticamente para a nova empresa.

Confira:

`/api/admin/multiempresa-health`

Agora:

```json
"organizations": {
  "count": 2
}
```

Teste o seletor e volte para Cris Salgados. Depois selecione novamente a nova
empresa.

Os produtos/pedidos de uma empresa não podem aparecer na outra.

---

## 8. Preparar a segunda loja

Na nova empresa:

1. Configurações:
   - nome/endereço;
   - horários;
   - formas de pagamento;
   - retirada/entrega;
   - marque `Aceitar pedidos`.

2. Cadastre pelo menos um produto real.

3. Se usar delivery, configure taxa/área.

4. No seletor de empresa, clique `Ativar` em Pedidos online.

Se faltar algo, a API recusa a ativação e informa o item pendente.

---

## 9. Loja pública da segunda empresa

Use:

`/loja/<slug-da-segunda-empresa>`

O seletor mostra `Abrir loja` e abre o slug da empresa ativa.

Faça um pedido pequeno.

O novo pedido deve existir SOMENTE no PostgreSQL da segunda organização.

Depois volte para Cris Salgados e confirme que o pedido da segunda empresa não
aparece.

---

## 10. Teste do checkout da Cris Salgados

A Fase 9 também muda a Cris Salgados para criação direta no PostgreSQL.

Faça um pedido pequeno na Cris e confira:

- pedido no Admin;
- estoque;
- acompanhamento;
- pontos, se houver cliente logado;
- `/api/admin/orders-health`;
- `/api/admin/operations-health`;
- `/api/admin/multiempresa-health`.

A Cris ainda mantém espelho temporário em `/data/store.json`.

---

## NÃO FAZER

- não apagar `/data/store.json`;
- não remover o Volume;
- não usar `--force`;
- não criar empresa direto no banco;
- não copiar CPF/CNPJ de terceiros;
- não ligar `ADMIN_LOGIN_MODE=postgres` antes de testar o login PostgreSQL;
- não apagar `ADMIN_PASSWORD` ainda;
- não misturar produtos entre empresas manualmente.

## Próxima fase

Fase 10 deverá focar em:

- convites e login individual da equipe via `sf_users + sf_memberships`;
- redefinição/troca de senha;
- domínio customizado com verificação;
- timezone por organização;
- impressão automática selecionando organização;
- políticas/RLS no PostgreSQL;
- desligamento progressivo do `store.json`.
