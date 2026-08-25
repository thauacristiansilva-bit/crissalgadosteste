# Recuperação da Fase 10 após a migration 010 ter sido aplicada antes da 009

Este patch **não substitui arquivos da Fase 11–12**. Ele adiciona apenas os arquivos da Fase 10 que ficaram ausentes, a migration 009 original e uma migration 011 de reparo do rollout RLS das tabelas criadas pela 010.

## Ordem segura

1. Extraia na raiz do projeto.
2. Rode build local.
3. Confira `git status --short`.
4. Adicione somente os arquivos deste patch que aparecerem modificados/novos.
5. Commit e push.
6. Aguarde Railway SUCCESS.
7. No console Railway rode `node scripts/migrate-multiempresa.mjs`.
8. O esperado é `OK 009_security_team_domain_rls`, `SKIP 010_food_composition_inventory` e `OK 011_backfill_rls_after_out_of_order_010`.
9. Confirme `/api/admin/security-health`.
10. Depois confirme `/api/admin/food-composition-health`.

Não habilite RLS manualmente. O enforcement deve permanecer preparado/desligado nesta fase.
