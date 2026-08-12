import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Somente o proprietário pode consultar a assinatura comercial." }, { status: 403 })
  }
  const billing = await getBillingSnapshotForOrganization(session.organizationId)
  return NextResponse.json({ billing })
}
