# SaborFlow — Correção FASE 24.7

## Objetivo

Corrigir os contadores comerciais `users` e `products` após a ativação do PostgreSQL RLS definitivo.

O `/admin` já voltou a abrir após a Fase 24.6. O `billing-health`, porém, ainda retornava `users: 0` e `products: 0` porque o cálculo de uso da conta consultava tabelas tenant (`sf_memberships` e `sf_products`) sem garantir um escopo RLS próprio da conta comercial.

## Alteração

Arquivo funcional único:

- `lib/billing-db.ts`

O backend agora:

1. deriva de `sf_organizations` as organizações pertencentes ao `billing_account_id`;
2. usa exatamente esses IDs como escopo RLS temporário para calcular o consumo comercial;
3. conta usuários distintos em todas as organizações da mesma conta;
4. continua contando produtos apenas na organização solicitada, como já era a regra do limite de produtos;
5. não usa `app.rls_bypass`, não desliga RLS e não altera policies.

## Banco

Não há migration.

## Instalação

Extraia na raiz, execute o build e publique somente `lib/billing-db.ts`.
