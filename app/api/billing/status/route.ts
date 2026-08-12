import { NextResponse } from "next/server"
import {
  getCommercialBillingStatus,
  reconcileLatestSubscriptionForUser,
} from "@/lib/billing-contracting"
import { getBillingIdentity } from "@/lib/billing-identity"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const identity = await getBillingIdentity()
  if (!identity) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  const url = new URL(request.url)
  if (url.searchParams.get("refresh") === "1") {
    await reconcileLatestSubscriptionForUser(identity.userId).catch((error) => {
      console.error("[SaborFlow Billing] Não foi possível reconciliar a assinatura:", error)
    })
  }
  const status = await getCommercialBillingStatus(identity.userId, identity.email)
  return NextResponse.json(status)
}
