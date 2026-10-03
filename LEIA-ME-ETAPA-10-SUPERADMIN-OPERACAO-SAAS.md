# Etapa 10 — Superadmin: Operação SaaS

Esta etapa amplia o `/superadmin` que já existia no SaborFlow. Ela não cria um segundo painel administrativo.

## Nova área

No Superadmin aparece uma nova aba **Operação SaaS** com visão consolidada de:

- contratos assinados e aprovados;
- contratos aprovados cujo e-mail ainda não foi enviado;
- falhas de envio do contrato;
- conexões WhatsApp ativas/com erro;
- conversas abertas e solicitações de atendimento humano;
- chamados abertos e urgentes;
- mensagens de integrações em fila/com falha;
- campanhas em rascunho/agendadas.

A tela também lista as pendências recentes para facilitar a operação da plataforma sem entrar empresa por empresa.

## Banco

Não há migration nova nesta etapa. Ela apenas consulta estruturas já criadas pelas etapas anteriores, inclusive 043, 046, 047 e 048. As consultas foram feitas com fallback para não derrubar o Superadmin se alguma tabela opcional ainda não existir em outro ambiente.

## Aplicação

1. Extraia o ZIP na raiz do projeto.
2. Rode `npm run build`.
3. Se passar, faça commit/push e deixe o Railway implantar.
4. Acesse `/superadmin` com sua conta autorizada e abra **Operação SaaS**.

Não é necessário executar `migrate-multiempresa.mjs` para esta etapa.
