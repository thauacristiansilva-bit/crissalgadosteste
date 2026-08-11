import { notFound } from "next/navigation"
import { OrderTracker } from "@/components/store/order-tracker"
import {
  getOrderByReference as getLegacyOrderByReference,
  getSettings as getLegacySettings,
} from "@/lib/db"
import {
  getTenantOrderByReference,
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  resolveServerPublicOrganization,
} from "@/lib/public-tenant"

export const dynamic = "force-dynamic"

export default async function OrderPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const decoded = decodeURIComponent(reference)

  const organization =
    await resolveServerPublicOrganization()

  if (!organization) notFound()

  const ordersReady =
    await isTenantOrdersReady(
      organization.id,
    ).catch(() => false)

  const isCurrent =
    await isCurrentDeploymentOrganization(
      organization.id,
    )

  const order = ordersReady
    ? await getTenantOrderByReference(
        organization.id,
        decoded,
      )
    : isCurrent
      ? await getLegacyOrderByReference(decoded)
      : null

  if (!order) notFound()

  const runtimeReady =
    await isTenantRuntimeReady(
      organization.id,
    ).catch(() => false)

  const settings =
    runtimeReady
      ? await getTenantSettings(organization.id)
      : isCurrent
        ? await getLegacySettings()
        : null

  if (!settings) notFound()

  return (
    <OrderTracker
      initialOrder={order}
      settings={settings}
      storePath={`/loja/${encodeURIComponent(
        organization.slug,
      )}`}
    />
  )
}
