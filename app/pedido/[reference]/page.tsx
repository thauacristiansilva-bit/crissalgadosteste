import { notFound } from "next/navigation"
import { OrderTracker } from "@/components/store/order-tracker"
import {
  getOrderByReference as getLegacyOrderByReference,
  getSettings,
} from "@/lib/db"
import { getCurrentDeploymentOrderByReference } from "@/lib/order-db"

export const dynamic = "force-dynamic"

export default async function OrderPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const decoded = decodeURIComponent(reference)

  const [postgresOrder, settings] = await Promise.all([
    getCurrentDeploymentOrderByReference(decoded).catch(() => null),
    getSettings(),
  ])

  const order =
    postgresOrder ||
    (await getLegacyOrderByReference(decoded))

  if (!order) notFound()

  return <OrderTracker initialOrder={order} settings={settings} />
}
