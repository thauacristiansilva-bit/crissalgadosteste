# SaborFlow — FASE 25.1 — RBAC operacional definitivo

Esta fase cria a camada de autorização operacional dentro de cada tenant, sobre o PostgreSQL + FORCE RLS já estabilizado nas Fases 24 e 25.

## Escopo

- Sem migration: reutiliza `sf_staff_members.permissions` (`jsonb[]`) já existente.
- Presets de função: proprietário, administrador, gerente, caixa/PDV, cozinha, entregador e membro.
- Permissões granulares no backend e filtragem da navegação do admin.
- Override por colaborador, persistido em `sf_staff_members.permissions`.
- O marcador `__saborflow_custom_permissions_v1__` distingue override explícito de arrays legados; arrays antigos sem marcador continuam usando o preset da função.
- Alteração de função em `sf_staff_members` sincroniza o papel da membership vinculada, exceto owner.
- Contexto RBAC usa `AsyncLocalStorage` singleton em `globalThis`, preservando o padrão robusto adotado pelo RLS na Fase 24.6.
- O RBAC nunca substitui nem contorna RLS. Toda consulta tenant continua limitada pelo `organization_id` do request.

## Presets

- **Owner**: todas as 28 permissões.
- **Admin**: 27 permissões; assinatura permanece governança do owner.
- **Manager**: 25 permissões operacionais; por padrão não gerencia permissões/logins, segurança crítica nem assinatura.
- **Cashier**: painel, PDV, caixa, pedidos, pagamento e clientes.
- **Kitchen**: pedidos + fluxo da cozinha.
- **Courier**: pedidos + atualização operacional compatível com entrega.
- **Member**: visão geral e conta/segurança básica.

Owner/Admin podem substituir o preset de um colaborador por uma allowlist personalizada na área **Equipe e acessos → Permissões**. Restaurar o padrão grava `permissions: []`.

## Segurança

- Navegação oculta módulos sem permissão, mas isso não é a barreira de segurança.
- APIs de pedidos, PDV, clientes, financeiro, DRE, configurações, equipe, domínios, impressão, relatórios, CRM, operação alimentar, integrações e módulos relacionados validam autorização no servidor.
- `access.manage` controla permissões, convites, recuperação de senha e desativação de login.
- `team.manage` controla o perfil operacional do colaborador.
- `billing.view` não entra no editor de colaboradores; a assinatura continua sob governança da conta.
- ACL corporativa de grupos/filiais continua independente do RBAC operacional tenant.

## Health check

Após o deploy:

`/api/admin/rbac-health`

Deve retornar `ok: true`, `phase: "25.1-operational-rbac"`, catálogo com 28 permissões e o acesso efetivo do usuário atual.

## Fora desta fase

As páginas dedicadas `/gerente`, `/pdv`, `/cozinha` e `/entregador` ficam para a Fase 25.2. Roteirização, GPS e acompanhamento em tempo real ficam nas fases posteriores de entrega.
