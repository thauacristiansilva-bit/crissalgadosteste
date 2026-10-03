# SaborFlow — Etapa 9: Central de Comunicação

Esta etapa adiciona uma área própria no painel administrativo para organizar chamados, notificações, campanhas e preferências de alerta.

## O que aparece no painel

Em **ATENDIMENTO** passa a existir:

- Central de comunicação
- WhatsApp

A Central de comunicação possui quatro abas:

1. **Chamados** — novo, em atendimento, aguardando cliente, resolvido e fechado; prioridade; responsável; histórico interno.
2. **Notificações** — alertas internos com lido/não lido e gravidade.
3. **Campanhas** — rascunhos/agendamentos para e-mail, WhatsApp, ambos ou mensagem interna.
4. **Preferências** — escolha de canais e tipos de alerta.

## Integração com WhatsApp

Quando a IA detectar pedido de atendimento humano no WhatsApp, o sistema também tenta gerar um alerta interno na Central de Comunicação. Se a migration ainda não tiver sido aplicada, essa tentativa não interrompe o atendimento do WhatsApp.

## Importante

Nesta etapa, campanhas são organizadas e agendadas no banco, mas o disparo externo em massa ainda não é executado. Isso evita envio acidental antes da configuração oficial dos canais e das preferências de comunicação.

Respostas de chamados ficam registradas internamente. O envio por e-mail/WhatsApp será conectado aos canais oficiais em etapa posterior.

## Instalação

Extraia o ZIP na raiz do projeto e rode:

```bash
npm run build
```

Se passar:

```bash
git add .
git commit -m "Adiciona central de comunicacao e notificacoes"
git push
```

Depois do deploy no Railway:

```bash
node scripts/migrate-multiempresa.mjs
```

Migration nova:

```text
048_communication_center.sql
```
