import { notFound } from "next/navigation"
import {
  OrderTracker,
} from "@/components/store/order-tracker"
import {
  getTenantOrderByReference,
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  resolveServerPublicOrganization,
} from "@/lib/public-tenant"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

export default async function TenantOrderPage({
  params,
}: {
  params: Promise<{
    slug: string
    reference: string
  }>
}) {
  const {
    slug,
    reference,
  } = await params

  const organization =
    await resolveServerPublicOrganization(
      decodeURIComponent(slug),
    )

  if (!organization) {
    notFound()
  }

  return runWithTenantRlsScope(
    [organization.id],
    undefined,
    async () => {
      const [ordersReady, runtimeReady] =
        await Promise.all([
          isTenantOrdersReady(
            organization.id,
          ).catch(() => false),
          isTenantRuntimeReady(
            organization.id,
          ).catch(() => false),
        ])

      if (
        !ordersReady ||
        !runtimeReady
      ) {
        notFound()
      }

      const [order, settings] =
        await Promise.all([
          getTenantOrderByReference(
            organization.id,
            decodeURIComponent(
              reference,
            ),
          ),
          getTenantSettings(
            organization.id,
          ),
        ])

      if (!order || !settings) {
        notFound()
      }

      return (
        <OrderTracker
          initialOrder={order}
          settings={settings}
          storePath={`/loja/${encodeURIComponent(
            organization.slug,
          )}/cardapio`}
        />
      )
    },
    "public-store",
  )
}
