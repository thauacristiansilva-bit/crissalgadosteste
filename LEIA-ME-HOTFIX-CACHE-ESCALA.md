# SaborFlow — Hotfix cache para múltiplas réplicas

## Problema observado
Com 2 réplicas e 350 VUs, a mediana ficou rápida, mas p95/p99 tiveram picos grandes. O cache público da Etapa 8 tinha TTL curto por réplica, porém não agrupava recargas simultâneas quando expirava.

## Correção
- Single-flight por organização e por réplica: várias requisições compartilham uma única recarga PostgreSQL.
- Stale-while-revalidate: quando o snapshot acabou de expirar, a loja continua servindo o último snapshot enquanto uma única atualização ocorre em segundo plano.
- Jitter de até 20% no TTL para reduzir expiração sincronizada entre réplicas.
- Mantém invalidação existente e cálculo de horário em cada request.

## Variáveis
Nenhuma variável nova é obrigatória.

Mantém a existente:
PUBLIC_STORE_CACHE_TTL_MS=15000

Opcional, apenas se quiser alterar a tolerância de snapshot stale durante falhas/renovação:
PUBLIC_STORE_CACHE_STALE_MS=30000

O padrão já é 30000 ms, portanto não é necessário criar essa variável no Railway.

## Deploy
Adicionar somente:

git add lib/public-store-db.ts
git add LEIA-ME-HOTFIX-CACHE-ESCALA.md

git commit -m "Hotfix - evita estouro de cache entre replicas"
git push origin main

Não requer migration, SQL, npm install ou alteração de R2.

## Reteste
Manter 2 réplicas e testar primeiro:
LOAD_VUS=350
LOAD_DURATION=1m

Só avançar para 500 se p95/p99 melhorarem e erros continuarem abaixo de 1%.
