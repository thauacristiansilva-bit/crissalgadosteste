import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getPostgresPool } from "@/lib/postgres"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"

export const dynamic = "force-dynamic"

const requiredTables = [
  "sf_billing_accounts",
  "sf_plans",
  "sf_plan_entitlements",
  "sf_subscriptions",
  "sf_subscription_events",
  "sf_usage_counters",
]

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  }

  const tables = await getPostgresPool().query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables],
  )
  const found = new Set(tables.rows.map((row) => row.table_name))
  const missing = requiredTables.filter((name) => !found.has(name))

  if (missing.length) {
    return NextResponse.json({
      ok: false,
      phase: "13-saas",
      ready: false,
      missingTables: missing,
      message: "Execute a migration 012_saas_billing_plans.",
    }, { status: 503 })
  }

  const billing = await getBillingSnapshotForOrganization(session.organizationId)
  const link = await getPostgresPool().query<{ billing_account_id: string | null }>(
    `SELECT billing_account_id FROM sf_organizations WHERE id = $1 LIMIT 1`,
    [session.organizationId],
  )

  return NextResponse.json({
    ok: Boolean(billing.ready && link.rows[0]?.billing_account_id),
    phase: "13-saas",
    ready: billing.ready,
    organizationLinked: Boolean(link.rows[0]?.billing_account_id),
    subscription: billing.subscription
      ? { status: billing.subscription.status, planCode: billing.subscription.planCode, internal: billing.subscription.internal }
      : null,
    usage: billing.usage,
    limits: {
      maxOrganizations: billing.entitlements.maxOrganizations,
      maxUsers: billing.entitlements.maxUsers,
      maxProducts: billing.entitlements.maxProducts,
    },
    authority: "backend-only",
  })
}
