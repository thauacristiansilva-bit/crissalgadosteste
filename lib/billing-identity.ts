import { getCommercialBillingSession } from "@/lib/billing-commercial-session"
import { getBillingAccountForUser } from "@/lib/billing-contracting"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export type BillingIdentity = {
  userId: string
  email: string
  billingAccountId: string
  source: "tenant" | "commercial"
  organizationId?: string
}

export async function getBillingIdentity(): Promise<BillingIdentity | null> {
  const tenant = await getVerifiedTenantSession().catch(() => null)
  if (tenant?.role === "owner") {
    const account = await getBillingAccountForUser(tenant.userId)
    if (!account) return null
    return {
      userId: tenant.userId,
      email: tenant.email,
      billingAccountId: account.id,
      source: "tenant",
      organizationId: tenant.organizationId,
    }
  }

  const commercial = await getCommercialBillingSession()
  if (!commercial) return null
  const account = await getBillingAccountForUser(commercial.userId)
  if (!account || account.id !== commercial.billingAccountId) return null
  return {
    userId: commercial.userId,
    email: commercial.email,
    billingAccountId: commercial.billingAccountId,
    source: "commercial",
  }
}
