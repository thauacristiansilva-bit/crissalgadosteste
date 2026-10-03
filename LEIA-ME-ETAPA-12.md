# ETAPA 12 — PUBLICAÇÕES PROGRAMADAS + FLYERS

Este pacote foi preparado para a base atual do SaborFlow (Next.js + PostgreSQL) e adiciona o novo bloco dentro da aba Marketing.

## O que entra

- Biblioteca com posts prontos para o dia a dia.
- Instagram Feed, Instagram Story e WhatsApp Status.
- Criador simples de flyer sem dependência npm nova.
- Geração e download em PNG.
- Upload da arte para o próprio SaborFlow.
- Data e horário da publicação.
- Recorrência diária ou semanal.
- Fila de publicações com status.
- Editar, pausar, copiar legenda, baixar arte e marcar como publicada.
- Isolamento por empresa usando o RLS já existente no SaborFlow.

## Aplicação

Na raiz do projeto, copie os 2 arquivos deste ZIP e rode:

```powershell
node APLICAR-ETAPA-12-PUBLICACOES-FLYERS.js
node APLICAR-MIGRATION-ETAPA-12.cjs
npm run typecheck
npm run build
```

Depois faça o deploy normal.

## Importante sobre postagem automática

Esta etapa cria a fila, o calendário/recorrência e as artes prontas. O envio realmente automático para uma rede social depende da conexão oficial daquele canal. O Status do WhatsApp não deve ser tratado como se fosse uma simples mensagem do WhatsApp Business; por isso esta etapa não simula uma automação inexistente. O módulo já deixa as publicações estruturadas para uma integração posterior sem perder as artes e os horários.

## Arquivos criados no projeto

- `database/migrations/20261003_etapa12_marketing_publications.sql`
- `lib/marketing-publications-db.ts`
- `app/api/marketing-publications/route.ts`
- `app/api/marketing-publications/[id]/route.ts`
- `app/api/marketing-publications/assets/route.ts`
- `app/api/marketing-publications/assets/[name]/route.ts`
- `components/admin/marketing-publications-panel.tsx`

O instalador também altera apenas `components/admin/marketing-panel.tsx`, adicionando o novo painel no topo da área de Marketing.
