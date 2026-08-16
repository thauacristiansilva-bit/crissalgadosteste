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

export async function getPublicStoreForOrganization(
  organization: PublicOrganization,
) {
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
    openNow: isStoreOpenNow(publicSettings),
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      publicOrderingEnabled: organization.publicOrderingEnabled,
    },
  }
}
