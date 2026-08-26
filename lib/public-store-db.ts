import {
  getTenantCategories,
  getTenantProducts,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import {
  getTenantDeliveryZones,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
  type PublicOrganization,
} from "@/lib/organization-db"
import { isStoreOpenNow } from "@/lib/operations"
import { runWithTenantRlsScope } from "@/lib/rls-context"

type PublicStoreSnapshot = {
  products: Awaited<ReturnType<typeof getTenantProducts>>
  categories: Awaited<ReturnType<typeof getTenantCategories>>
  settings: NonNullable<Awaited<ReturnType<typeof getTenantSettings>>>
  deliveryZones: Awaited<ReturnType<typeof getTenantDeliveryZones>>
  organization: {
    id: string
    name: string
    slug: string
    publicOrderingEnabled: boolean
  }
}

type PublicStoreCacheEntry = {
  expiresAt: number
  staleUntil: number
  snapshot: PublicStoreSnapshot
}

type GlobalWithPublicStoreCache = typeof globalThis & {
  __saborflowPublicStoreCache?: Map<string, PublicStoreCacheEntry>
  __saborflowPublicStoreRefreshes?: Map<string, Promise<PublicStoreSnapshot>>
}

function cacheTtlMs() {
  const raw = Number(process.env.PUBLIC_STORE_CACHE_TTL_MS || 15_000)
  if (!Number.isFinite(raw)) return 15_000
  return Math.max(0, Math.min(60_000, Math.floor(raw)))
}

function staleGraceMs() {
  const raw = Number(process.env.PUBLIC_STORE_CACHE_STALE_MS || 30_000)
  if (!Number.isFinite(raw)) return 30_000
  return Math.max(0, Math.min(120_000, Math.floor(raw)))
}

function publicStoreCache() {
  const globalCache = globalThis as GlobalWithPublicStoreCache
  if (!globalCache.__saborflowPublicStoreCache) {
    globalCache.__saborflowPublicStoreCache = new Map()
  }
  return globalCache.__saborflowPublicStoreCache
}

function publicStoreRefreshes() {
  const globalCache = globalThis as GlobalWithPublicStoreCache
  if (!globalCache.__saborflowPublicStoreRefreshes) {
    globalCache.__saborflowPublicStoreRefreshes = new Map()
  }
  return globalCache.__saborflowPublicStoreRefreshes
}

function readCachedSnapshot(organizationId: string) {
  const cache = publicStoreCache()
  const cached = cache.get(organizationId)
  if (!cached) return null

  const now = Date.now()
  if (cached.staleUntil <= now) {
    cache.delete(organizationId)
    return null
  }

  return {
    snapshot: cached.snapshot,
    fresh: cached.expiresAt > now,
  }
}

function writeCachedSnapshot(organizationId: string, snapshot: PublicStoreSnapshot) {
  const ttl = cacheTtlMs()
  if (ttl <= 0) return

  // Pequeno jitter evita que várias réplicas renovem o cache exatamente juntas.
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(ttl * 0.2)))
  const expiresAt = Date.now() + ttl + jitter

  const cache = publicStoreCache()
  cache.set(organizationId, {
    expiresAt,
    staleUntil: expiresAt + staleGraceMs(),
    snapshot,
  })

  // Evita crescimento sem limite em processos que atendem muitos tenants.
  if (cache.size > 250) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey) cache.delete(oldestKey)
  }
}

export function invalidatePublicStoreCache(organizationId?: string) {
  const cache = publicStoreCache()
  if (organizationId) cache.delete(organizationId)
  else cache.clear()
}

async function loadPublicStoreSnapshot(organization: PublicOrganization) {
  return runWithTenantRlsScope(
    [organization.id],
    undefined,
    async (): Promise<PublicStoreSnapshot> => {
      const [runtimeReady, catalogReady, operationsReady] = await Promise.all([
        isTenantRuntimeReady(organization.id).catch(() => false),
        isTenantCatalogReady(organization.id).catch(() => false),
        isTenantOperationsReady(organization.id).catch(() => false),
      ])

      if (!runtimeReady || !catalogReady || !operationsReady) {
        throw new Error(
          "A loja ainda não concluiu a preparação PostgreSQL necessária para publicação.",
        )
      }

      const [settings, products, categories, deliveryZones] = await Promise.all([
        getTenantSettings(organization.id),
        getTenantProducts(organization.id),
        getTenantCategories(organization.id),
        getTenantDeliveryZones(organization.id),
      ])

      if (!settings) {
        throw new Error("Configurações públicas da empresa não foram encontradas.")
      }

      const publicSettings = {
        ...settings,
        systemName: "SaborFlow",
        acceptingOrders:
          settings.acceptingOrders && organization.publicOrderingEnabled,
      }

      return {
        products,
        categories,
        settings: publicSettings,
        deliveryZones,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          publicOrderingEnabled: organization.publicOrderingEnabled,
        },
      }
    },
    "public-store",
  )
}

/**
 * Single-flight por tenant: enquanto uma réplica está atualizando o snapshot,
 * todas as requisições concorrentes compartilham a mesma Promise em vez de
 * disparar dezenas/centenas de consultas PostgreSQL ao mesmo tempo.
 */
function refreshPublicStoreSnapshot(organization: PublicOrganization) {
  const refreshes = publicStoreRefreshes()
  const current = refreshes.get(organization.id)
  if (current) return current

  const refresh = loadPublicStoreSnapshot(organization)
    .then((snapshot) => {
      writeCachedSnapshot(organization.id, snapshot)
      return snapshot
    })
    .finally(() => {
      if (refreshes.get(organization.id) === refresh) {
        refreshes.delete(organization.id)
      }
    })

  refreshes.set(organization.id, refresh)
  return refresh
}

export async function getPublicStoreForOrganization(
  organization: PublicOrganization,
) {
  const cached = readCachedSnapshot(organization.id)
  let snapshot: PublicStoreSnapshot

  if (cached?.fresh) {
    snapshot = cached.snapshot
  } else if (cached) {
    // Stale-while-revalidate: mantém a loja rápida durante a renovação.
    // Apenas uma atualização por tenant é executada por réplica.
    void refreshPublicStoreSnapshot(organization).catch(() => undefined)
    snapshot = cached.snapshot
  } else {
    snapshot = await refreshPublicStoreSnapshot(organization)
  }

  return {
    ...snapshot,
    // Horário continua sendo calculado a cada request, mesmo quando catálogo está em cache.
    openNow: isStoreOpenNow(snapshot.settings),
  }
}
