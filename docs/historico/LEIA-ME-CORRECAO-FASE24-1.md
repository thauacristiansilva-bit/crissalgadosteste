# SaborFlow — Correção Fase 24.1

Correção do bridge PostgreSQL RLS introduzido na Fase 24.

## Problema corrigido

`pool.connect()` obtinha uma conexão do pool e, enquanto a mantinha reservada, consultava o próprio pool para descobrir se o papel `saborflow_rls_app` estava disponível. Com concorrência suficiente, as conexões podiam ficar todas reservadas aguardando uma nova conexão para a checagem do papel, causando starvation/deadlock aparente e endpoints que ficavam carregando indefinidamente.

## Correção

A checagem do papel RLS agora é feita usando a própria conexão já obtida. Não há aquisição aninhada de conexão. O mesmo princípio foi aplicado a `pool.query()`.

O cache negativo do papel também foi reduzido para 250 ms, evitando uma janela longa de execução sem bridge logo após a migration criar o papel.

## Banco de dados

Não há migration nesta correção. Não reverta nem execute novamente a migration 023 manualmente.
