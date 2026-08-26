# Ajuste do pool PostgreSQL — Etapa 9

Não substitua automaticamente a lógica de banco/RLS existente. No arquivo que já cria `new Pool(...)`, mantenha a lógica atual e ajuste as opções:

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? "10"),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? "30000"),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? "5000"),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? "15000"),
  application_name: "saborflow-app",
});
```

Variáveis iniciais:
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
DB_STATEMENT_TIMEOUT_MS=15000

Com réplicas: conexões potenciais = DB_POOL_MAX × número de réplicas.
