import { notFound } from "next/navigation"
import { OrderTracker } from "@/components/store/order-tracker"
import { getOrderByReference, getSettings } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function OrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  const [order, settings] = await Promise.all([getOrderByReference(decodeURIComponent(reference)), getSettings()])
  if (!order) notFound()
  return <OrderTracker initialOrder={order} whatsapp={settings.whatsapp} storeName={settings.storeName} estimatedMinutes={settings.estimatedMinutes} />
}
