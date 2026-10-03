# Etapa 8C — WhatsApp: modelos, notas e histórico

Esta etapa evolui a Central WhatsApp já criada na Etapa 8.

## O que entra

- respostas livres dentro da janela de 24h passam a ser enviadas como **texto**, e não como template;
- fora da janela, a tela exige a escolha de um **modelo marcado como aprovado**;
- cadastro local dos modelos usados na Meta, com nome, idioma, categoria, status, texto e variáveis `{{1}}`, `{{2}}`;
- notas internas por conversa, invisíveis ao cliente;
- histórico de ações da conversa (IA, atendente, transferência, fechamento, etiquetas etc.);
- etiquetas automáticas simples para Pedido, Reclamação, Financeiro, Entrega e Suporte;
- mantém compatibilidade com o template antigo configurado na conexão para os fluxos legados.

## Importante

Nesta etapa, o status do modelo é registrado no SaborFlow conforme o status que existe na Meta. A sincronização automática/criação do template diretamente pela Meta fica para depois da liberação do Embedded Signup/App Review.

## Instalação

1. Extraia o ZIP na raiz do projeto.
2. Rode `npm run build`.
3. Faça commit/push.
4. No Railway, rode `node scripts/migrate-multiempresa.mjs` para aplicar `047_whatsapp_templates_notes_activity.sql`.

