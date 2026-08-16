"use client"

import { useEffect, useState } from "react"
import { KitchenPanel } from "@/components/admin/kitchen-panel"
import { OperationalShell } from "@/components/operational/operational-shell"
import type { Order, StoreSettings } from "@/lib/types"

export function KitchenWorkspace({
  organizationName,
  initialOrders,
  settings,
}: {
  organizationName: string
  initialOrders: Order[]
  settings: StoreSettings
}) {
  const [orders, setOrders] = useState(initialOrders)

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/dashboard", { cache: "no-store" }).catch(() => null)
      if (!response?.ok) return
      const data = (await response.json()) as { orders?: Order[] }
      if (Array.isArray(data.orders)) setOrders(data.orders)
    }

    const id = window.setInterval(refresh, 4000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <OperationalShell
      title="Cozinha"
      subtitle="A cozinha vê somente a fila de produção e controla o fluxo até o pedido ficar pronto."
      organizationName={organizationName}
      roleLabel="Cozinha"
    >
      <KitchenPanel
        orders={orders}
        settings={settings}
        onOrderUpdated={(updated) =>
          setOrders((current) => current.map((order) => order.id === updated.id ? updated : order))
        }
      />
    </OperationalShell>
  )
}
