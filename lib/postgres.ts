import { Pool } from "pg"

type GlobalWithPostgres = typeof globalThis & {
  __saborflowPostgresPool?: Pool
}

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada.")
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
}

export function getPostgresPool() {
  const globalForPostgres = globalThis as GlobalWithPostgres

  if (!globalForPostgres.__saborflowPostgresPool) {
    globalForPostgres.__saborflowPostgresPool = createPool()
  }

  return globalForPostgres.__saborflowPostgresPool
}

export async function checkPostgresConnection() {
  const result = await getPostgresPool().query<{
    ok: number
    checked_at: Date
  }>("SELECT 1 AS ok, NOW() AS checked_at")

  return {
    ok: result.rows[0]?.ok === 1,
    checkedAt: result.rows[0]?.checked_at ?? new Date(),
  }
}
