import { Pool, type PoolClient } from "pg"
import { getCurrentRlsContext } from "@/lib/rls-context"

type GlobalWithPostgres = typeof globalThis & {
  __saborflowPostgresPool?: Pool
}

const RLS_RUNTIME_ROLE = "saborflow_rls_app"
const RLS_ROLE_CACHE_MS = 5_000

let roleCache:
  | { available: boolean; checkedAt: number }
  | undefined

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name])
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function createRawPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada.")
  }

  return new Pool({
    connectionString,
    max: integerEnv("POSTGRES_POOL_MAX", 5, 1, 30),
    idleTimeoutMillis: integerEnv("POSTGRES_IDLE_TIMEOUT_MS", 30_000, 5_000, 120_000),
    connectionTimeoutMillis: integerEnv("POSTGRES_CONNECT_TIMEOUT_MS", 5_000, 1_000, 30_000),
  })
}

type RoleQuery = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values?: unknown[],
) => Promise<{ rows: T[] }>

async function runtimeRoleAvailable(
  query: RoleQuery,
  force = false,
) {
  const now = Date.now()
  const cacheTtl = roleCache?.available ? RLS_ROLE_CACHE_MS : 250

  if (
    !force &&
    roleCache &&
    now - roleCache.checkedAt < cacheTtl
  ) {
    return roleCache.available
  }

  const result = await query<{ available: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = $1
          AND rolsuper = false
          AND rolbypassrls = false
      ) AS available
    `,
    [RLS_RUNTIME_ROLE],
  )

  roleCache = {
    available: Boolean(result.rows[0]?.available),
    checkedAt: now,
  }

  return roleCache.available
}

function contextSettings() {
  const context = getCurrentRlsContext()
  const organizationIds = context?.organizationIds ?? []

  return {
    organizationId: organizationIds[0] ?? "",
    organizationIds: organizationIds.join(","),
    userId: context?.userId ?? "",
    bypass: context?.bypass ? "true" : "false",
  }
}

async function applyRlsSettings(
  client: PoolClient,
  local: boolean,
) {
  const settings = contextSettings()

  await client.query(
    local
      ? `SET LOCAL ROLE ${RLS_RUNTIME_ROLE}`
      : `SET ROLE ${RLS_RUNTIME_ROLE}`,
  )

  await client.query(
    `
      SELECT
        set_config('app.organization_id', $1, $5),
        set_config('app.organization_ids', $2, $5),
        set_config('app.user_id', $3, $5),
        set_config('app.rls_bypass', $4, $5)
    `,
    [
      settings.organizationId,
      settings.organizationIds,
      settings.userId,
      settings.bypass,
      local,
    ],
  )
}

async function cleanupCheckedOutClient(client: PoolClient) {
  try {
    await client.query("ROLLBACK")
  } catch {
    // A conexão pode já estar fora de uma transação; seguimos para o reset.
  }

  await client.query("RESET app.organization_id").catch(() => undefined)
  await client.query("RESET app.organization_ids").catch(() => undefined)
  await client.query("RESET app.user_id").catch(() => undefined)
  await client.query("RESET app.rls_bypass").catch(() => undefined)
  await client.query("RESET ROLE").catch(() => undefined)
}

function installRlsBridge(pool: Pool) {
  const rawConnect = pool.connect.bind(pool)

  pool.query = (async (...args: unknown[]) => {
    const client = await rawConnect()
    const clientQuery = client.query.bind(client) as RoleQuery

    try {
      if (!(await runtimeRoleAvailable(clientQuery))) {
        return await (client.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args)
      }

      await client.query("BEGIN")
      await applyRlsSettings(client, true)
      const result = await (client.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args)
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }) as Pool["query"]

  pool.connect = (async () => {
    const client = await rawConnect()
    const clientQuery = client.query.bind(client) as RoleQuery

    if (!(await runtimeRoleAvailable(clientQuery))) {
      return client
    }

    try {
      await applyRlsSettings(client, false)
    } catch (error) {
      client.release(error as Error)
      throw error
    }

    const originalRelease = client.release
    let released = false

    client.release = ((error?: Error | boolean) => {
      if (released) return
      released = true
      client.release = originalRelease

      if (error) {
        originalRelease.call(client, error)
        return
      }

      void cleanupCheckedOutClient(client)
        .then(() => originalRelease.call(client))
        .catch((cleanupError) => {
          originalRelease.call(
            client,
            cleanupError instanceof Error
              ? cleanupError
              : new Error("Falha ao limpar contexto RLS da conexão."),
          )
        })
    }) as PoolClient["release"]

    return client
  }) as Pool["connect"]

  return pool
}

function createPool() {
  return installRlsBridge(createRawPool())
}

export function getPostgresPool() {
  const globalForPostgres = globalThis as GlobalWithPostgres

  if (!globalForPostgres.__saborflowPostgresPool) {
    globalForPostgres.__saborflowPostgresPool = createPool()
  }

  return globalForPostgres.__saborflowPostgresPool
}

export async function getRlsRuntimeBridgeStatus() {
  roleCache = undefined
  const result = await getPostgresPool().query<{ available: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = $1
          AND rolsuper = false
          AND rolbypassrls = false
      ) AS available
    `,
    [RLS_RUNTIME_ROLE],
  ).catch(() => ({ rows: [{ available: false }] }))

  const roleAvailable = Boolean(result.rows[0]?.available)
  return {
    role: RLS_RUNTIME_ROLE,
    roleAvailable,
    failClosedWhenUnscoped: roleAvailable,
  }
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
