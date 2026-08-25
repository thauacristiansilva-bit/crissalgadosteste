import { NextResponse } from "next/server"
import { getCurrentCustomerContext } from "@/lib/client-auth"
import { getTenantOrdersForCustomerAccount, isTenantOrdersReady } from "@/lib/order-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

export async function GET() {
  const context = await getCurrentCustomerContext()

  if (!context) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  return runWithTenantRlsScope(
    [context.organizationId],
    undefined,
    async () => {
      const ready = await isTenantOrdersReady(context.organizationId).catch(() => false)
      if (!ready) {
        return NextResponse.json(
          { error: "Histórico de pedidos indisponível no momento." },
          { status: 503 },
        )
      }

      const orders = await getTenantOrdersForCustomerAccount(
        context.organizationId,
        context.account.id,
        12,
      )

      return NextResponse.json({ orders })
    },
    "customer-session",
  )
}
