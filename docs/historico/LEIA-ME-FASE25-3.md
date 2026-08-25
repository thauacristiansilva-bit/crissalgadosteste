# SaborFlow — FASE 25.3

## Expedição e identidade do entregador

Esta fase conecta o cadastro operacional de entregadores (`sf_couriers`) ao colaborador/login (`sf_staff_members`).

### Entregas

- cada perfil de entregador pode ser vinculado a um colaborador com função `courier`;
- o vínculo é único dentro da empresa;
- o entregador autenticado em `/entregador` recebe apenas pedidos atribuídos ao próprio perfil;
- o backend impede um entregador de iniciar/finalizar pedido atribuído a outro entregador;
- owner/admin/manager continuam atribuindo entregadores nos pedidos;
- Configurações > Entregadores passa a exibir o vínculo com colaborador/login;
- `/api/orders` e `/api/dashboard` não devolvem pedidos de outros entregadores para um login `courier`;
- o ticket PDF também respeita a atribuição individual;
- novo health check: `/api/admin/delivery-dispatch-health`.

### Migration

Aplicar `database/migrations/025_delivery_dispatch_identity.sql` após o deploy.

A migration apenas adiciona `staff_member_id` a `sf_couriers`, com FK tenant-safe e índice único. Ela não cria uma nova tabela tenant; portanto o rollout RLS continua com as mesmas 45 tabelas da Fase 24.

A policy `sf_tenant_guard`, `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` de `sf_couriers` são reafirmados explicitamente.

### Limites desta fase

- otimização de rota: Fase 25.4;
- GPS e posição periódica: Fase 25.5;
- acompanhamento em tempo real pelo cliente: Fase 25.5;
- um entregador sem login vinculado ainda pode existir para operação manual, mas não recebe pedidos no workspace individual.
