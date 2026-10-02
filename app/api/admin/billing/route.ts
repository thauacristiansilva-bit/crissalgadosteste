import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { getDemoEnvironmentForOrganization } from "@/lib/demo-policy"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Somente o proprietário pode consultar a assinatura comercial." }, { status: 403 })
  }

  const [billing, demo] = await Promise.all([
    getBillingSnapshotForOrganization(session.organizationId),
    getDemoEnvironmentForOrganization(session.organizationId),
  ])

  const trial = demo?.basicMode
    ? {
        active: demo.status === "active",
        startedAt: demo.startedAt,
        expiresAt: demo.expiresAt,
        totalDays: 7,
        daysRemaining: Math.max(0, Math.ceil((new Date(demo.expiresAt).getTime() - Date.now()) / 86_400_000)),
      }
    : null

  return NextResponse.json({ billing, trial, email: session.email })
}
