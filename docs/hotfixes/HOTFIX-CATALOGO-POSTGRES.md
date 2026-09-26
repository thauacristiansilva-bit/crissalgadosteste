# Hotfix — Catálogo PostgreSQL tenant-aware

Corrige rotas de Produtos e Categorias que ainda possuíam fallback para `store.json` quando `sf_catalog_state.ready` estivesse falso.

Como o legado foi desligado na Fase 25, esse fallback gerava o erro:

> Legado store.json desligado na Fase 25. A atualização de produto deve usar PostgreSQL tenant-aware.

A partir deste hotfix, as rotas administrativas de catálogo exigem sessão tenant válida e usam diretamente PostgreSQL/RLS. Nenhuma migration é necessária.
