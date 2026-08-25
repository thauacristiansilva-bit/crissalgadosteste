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

type GlobalWithPublicStoreCache = typeof globalThis & {
  __saborflowPublicStoreCache?: Map<
    string,
    { expiresAt: number; snapshot: PublicStoreSnapshot }
  >
}

function cacheTtlMs() {
  const raw = Number(process.env.PUBLIC_STORE_CACHE_TTL_MS || 15_000)
  if (!Number.isFinite(raw)) return 15_000
  return Math.max(0, Math.min(60_000, Math.floor(raw)))
}

function publicStoreCache() {
  const globalCache = globalThis as GlobalWithPublicStoreCache
  if (!globalCache.__saborflowPublicStoreCache) {
    globalCache.__saborflowPublicStoreCache = new Map()
  }
  return globalCache.__saborflowPublicStoreCache
}

function readCachedSnapshot(organizationId: string) {
  const cache = publicStoreCache()
  const cached = cache.get(organizationId)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    cache.delete(organizationId)
    return null
  }
  return cached.snapshot
}

function writeCachedSnapshot(organizationId: string, snapshot: PublicStoreSnapshot) {
  const ttl = cacheTtlMs()
  if (ttl <= 0) return

  const cache = publicStoreCache()
  cache.set(organizationId, {
    expiresAt: Date.now() + ttl,
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

export async function getPublicStoreForOrganization(
  organization: PublicOrganization,
) {
  const cached = readCachedSnapshot(organization.id)
  const snapshot = cached || await loadPublicStoreSnapshot(organization)

  if (!cached) {
    writeCachedSnapshot(organization.id, snapshot)
  }

  return {
    ...snapshot,
    // Horário continua sendo calculado a cada request, mesmo quando catálogo está em cache.
    openNow: isStoreOpenNow(snapshot.settings),
  }
}
