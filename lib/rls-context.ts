import { AsyncLocalStorage } from "node:async_hooks"

export type RlsContextSource =
  | "tenant-session"
  | "customer-session"
  | "public-store"
  | "corporate-report"
  | "bootstrap-user"
  | "privileged-backend"

export type RlsContext = {
  organizationIds: string[]
  userId?: string
  bypass: boolean
  source: RlsContextSource
}

type GlobalWithRlsStorage = typeof globalThis & {
  __saborflowRlsContextStorage?: AsyncLocalStorage<RlsContext>
}

function getRlsStorage() {
  const globalForRls = globalThis as GlobalWithRlsStorage

  if (!globalForRls.__saborflowRlsContextStorage) {
    globalForRls.__saborflowRlsContextStorage = new AsyncLocalStorage<RlsContext>()
  }

  return globalForRls.__saborflowRlsContextStorage
}

// Next/Turbopack pode materializar o mesmo módulo em chunks server diferentes.
// O singleton em globalThis garante que auth.ts, páginas SSR e postgres.ts
// compartilhem a MESMA AsyncLocalStorage dentro do processo Node.
const storage = getRlsStorage()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeOrganizationIds(values: string[]) {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))]

  if (unique.length > 100) {
    throw new Error("O escopo RLS excede o limite de 100 organizações.")
  }

  for (const value of unique) {
    if (!UUID_PATTERN.test(value)) {
      throw new Error("organization_id inválido no contexto RLS.")
    }
  }

  return unique
}

function normalizeUserId(value?: string | null) {
  const clean = value?.trim()
  if (!clean) return undefined
  if (!UUID_PATTERN.test(clean)) {
    throw new Error("user_id inválido no contexto RLS.")
  }
  return clean
}

export function getCurrentRlsContext(): RlsContext | undefined {
  return storage.getStore()
}

export function enterTenantRlsContext(
  organizationId: string,
  userId?: string | null,
  source: RlsContextSource = "tenant-session",
) {
  const previous = storage.getStore()
  storage.enterWith({
    organizationIds: normalizeOrganizationIds([organizationId]),
    userId: normalizeUserId(userId) ?? previous?.userId,
    bypass: false,
    source,
  })
}

export function enterTenantRlsScope(
  organizationIds: string[],
  userId?: string | null,
  source: RlsContextSource = "tenant-session",
) {
  const previous = storage.getStore()
  storage.enterWith({
    organizationIds: normalizeOrganizationIds(organizationIds),
    userId: normalizeUserId(userId) ?? previous?.userId,
    bypass: false,
    source,
  })
}

export function enterRlsUserContext(
  userId: string,
  source: RlsContextSource = "bootstrap-user",
) {
  const previous = storage.getStore()
  storage.enterWith({
    organizationIds: previous?.organizationIds ?? [],
    userId: normalizeUserId(userId),
    bypass: previous?.bypass ?? false,
    source,
  })
}

export async function runWithTenantRlsScope<T>(
  organizationIds: string[],
  userId: string | null | undefined,
  callback: () => Promise<T>,
  source: RlsContextSource = "tenant-session",
): Promise<T> {
  return storage.run(
    {
      organizationIds: normalizeOrganizationIds(organizationIds),
      userId: normalizeUserId(userId),
      bypass: false,
      source,
    },
    callback,
  )
}

export async function runWithRlsUserContext<T>(
  userId: string,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = storage.getStore()
  return storage.run(
    {
      organizationIds: previous?.organizationIds ?? [],
      userId: normalizeUserId(userId),
      bypass: false,
      source: "bootstrap-user",
    },
    callback,
  )
}

export async function runWithRlsBypass<T>(
  callback: () => Promise<T>,
): Promise<T> {
  const previous = storage.getStore()
  return storage.run(
    {
      organizationIds: previous?.organizationIds ?? [],
      userId: previous?.userId,
      bypass: true,
      source: "privileged-backend",
    },
    callback,
  )
}
