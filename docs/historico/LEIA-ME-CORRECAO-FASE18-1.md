# SaborFlow — Correção Fase 18.1

Objetivo: separar de forma inequívoca a operação da plataforma SaborFlow do painel das empresas clientes.

## O que entra

- Fila de validação de novos cadastros comerciais no Superadmin.
- Novas contas reais entram como `pending`; demos/trials técnicos não entram na fila.
- Contas existentes são aprovadas na migration para não interromper clientes legados.
- Uma nova loja não pode concluir a publicação comercial enquanto o cadastro da conta não estiver `approved`.
- Aba de planos passa a mostrar assinaturas ativas e MRR equivalente por plano.
- Nova DRE gerencial da própria SaborFlow, separada do financeiro dos tenants.
- Lançamentos de receita/despesa por competência, categoria, contraparte, vencimento e status.
- MRR contratado aparece como indicador comercial e NÃO é somado automaticamente à receita realizada da DRE.
- Ações de validação e financeiro continuam auditadas em `sf_platform_admin_actions`.

## Migration

`database/migrations/018_superadmin_registration_finance.sql`

Cria:

- `sf_platform_registration_reviews`
- trigger de fila automática para novos billing accounts reais
- `sf_platform_finance_entries`

## Segurança

- `/superadmin` continua exigindo `sf_platform_admins` ativo.
- aprovação/rejeição: `owner` ou `operator`.
- financeiro da plataforma: `owner`, `operator` ou `finance`.
- financeiro da SaborFlow não usa `organization_id` e não se mistura com DRE/financeiro das empresas.
- demos são excluídas das métricas comerciais e da fila de cadastros.

## Ordem de instalação

1. Extrair na raiz do projeto.
2. `git restore next-env.d.ts`
3. limpar `.next` e rodar `npm run build`.
4. publicar os arquivos funcionais.
5. após Railway `SUCCESS`, rodar `node scripts/migrate-multiempresa.mjs` para aplicar a migration 018.
6. testar `/superadmin`, `/api/superadmin/health` e `/api/admin/billing-health`.
