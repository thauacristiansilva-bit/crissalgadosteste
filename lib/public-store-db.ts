import {
  getCurrentDeploymentOrganizationId,
  getTenantCategories,
  getTenantProducts,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import {
  getDeliveryZones as getLegacyDeliveryZones,
  getPublicStore as getLegacyPublicStore,
  getSettings as getLegacySettings,
} from "@/lib/db"
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
  const currentDeploymentOrganizationId =
    await getCurrentDeploymentOrganizationId()

  const isCurrentDeployment =
    currentDeploymentOrganizationId ===
    organization.id

  const runtimeReady =
    await isTenantRuntimeReady(
      organization.id,
    ).catch(() => false)

  const settings =
    runtimeReady
      ? await getTenantSettings(organization.id)
      : isCurrentDeployment
        ? await getLegacySettings()
        : null

  if (!settings) {
    throw new Error(
      "Configurações públicas da empresa ainda não estão disponíveis.",
    )
  }

  let products = []
  let categories = []

  if (
    await isTenantCatalogReady(
      organization.id,
    ).catch(() => false)
  ) {
    ;[products, categories] = await Promise.all([
      getTenantProducts(organization.id),
      getTenantCategories(organization.id),
    ])
  } else if (isCurrentDeployment) {
    const legacy = await getLegacyPublicStore()
    products = legacy.products
    categories = legacy.categories
  }

  let deliveryZones = []

  if (
    await isTenantOperationsReady(
      organization.id,
    ).catch(() => false)
  ) {
    deliveryZones = await getTenantDeliveryZones(
      organization.id,
    )
  } else if (isCurrentDeployment) {
    deliveryZones =
      await getLegacyDeliveryZones()
  }

  const publicSettings = {
    ...settings,
    systemName: "SaborFlow",
    acceptingOrders:
      settings.acceptingOrders &&
      organization.publicOrderingEnabled,
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
      publicOrderingEnabled:
        organization.publicOrderingEnabled,
    },
  }
}
