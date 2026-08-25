# SaborFlow — Correção Fase 25-R1

Correção do corte do legado após a ativação definitiva do PostgreSQL + FORCE RLS.

## Problema corrigido

A Fase 25 desligou corretamente o `store.json`, porém alguns fluxos dependiam de contexto RLS implícito atravessando helpers/chunks assíncronos. O efeito observado foi `legacy-health` com todos os `*Ready=false` e storefront/fluxos públicos indisponíveis apesar de os dados existirem no PostgreSQL.

## O que muda

- Reafirma o tenant no fim de `getVerifiedTenantSession()` para que todas as rotas admin seguintes saiam do helper com escopo RLS ativo.
- Executa o carregamento inteiro da loja pública dentro de `runWithTenantRlsScope()`.
- Executa o checkout PostgreSQL dentro de escopo explícito, preservando o `userId` quando houver.
- Mantém o contexto do cliente ativo após validação da sessão.
- Corrige login/cadastro do cliente, cupom público, cotação de entrega, feedback e acompanhamento de pedido para operar em escopo tenant explícito.
- Remove fallback legado dos fluxos de cupom/feedback tocados nesta correção.
- Corrige `/api/admin/legacy-health` para validar os estados PostgreSQL no tenant real.

## Segurança

- Não desliga RLS.
- Não remove FORCE RLS.
- Não altera policies.
- Não usa bypass para dados tenant.
- Não reativa `store.json`.
- Não possui migration.

## Validação esperada

1. `npm run build` deve concluir com sucesso.
2. `/api/admin/legacy-health` deve retornar `ok: true` e todos os readiness como `true`.
3. `/loja/cris-salgados` deve abrir no Railway.
4. `/api/admin/billing-health` deve permanecer com `organizations: 2`, `users: 1`, `products: 2` no ambiente validado antes da correção.
5. `/api/admin/rls-health` deve manter 45/45 enabled + forced.

## Observação sobre localhost

`http://localhost:3000/...` só funciona quando o servidor local estiver em execução. Para teste local, rode `npm run dev` e mantenha o terminal aberto. A correção não inicia o servidor automaticamente.
