import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getPostgresPool } from "@/lib/postgres"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { billingProviderConfiguration } from "@/lib/billing-provider"

export const dynamic = "force-dynamic"

const requiredTables = [
  "sf_billing_accounts",
  "sf_plans",
  "sf_plan_entitlements",
  "sf_subscriptions",
  "sf_subscription_events",
  "sf_usage_counters",
  "sf_checkout_sessions",
  "sf_billing_webhook_events",
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
      phase: "14-billing",
      ready: false,
      missingTables: missing,
      message: "Execute as migrations comerciais até 013_billing_checkout_webhooks.",
    }, { status: 503 })
  }

  const billing = await getBillingSnapshotForOrganization(session.organizationId)
  const link = await getPostgresPool().query<{ billing_account_id: string | null }>(
    `SELECT billing_account_id FROM sf_organizations WHERE id = $1 LIMIT 1`,
    [session.organizationId],
  )
  const plans = await getPostgresPool().query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM sf_plans
    WHERE active = true
      AND internal = false
      AND checkout_enabled = true
      AND (COALESCE(monthly_price_cents, 0) > 0 OR COALESCE(annual_price_cents, 0) > 0)
  `)
  const provider = billingProviderConfiguration()
  const webhookConfigured = Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim())
  const appBaseUrlConfigured = Boolean(process.env.APP_BASE_URL?.trim())
  const publicPlans = Number(plans.rows[0]?.count || 0)

  return NextResponse.json({
    ok: Boolean(billing.ready && link.rows[0]?.billing_account_id),
    phase: "14-billing",
    ready: billing.ready,
    organizationLinked: Boolean(link.rows[0]?.billing_account_id),
    subscription: billing.subscription
      ? {
          status: billing.subscription.status,
          planCode: billing.subscription.planCode,
          internal: billing.subscription.internal,
          provider: billing.subscription.provider || null,
          billingCycle: billing.subscription.billingCycle || null,
        }
      : null,
    usage: billing.usage,
    limits: {
      maxOrganizations: billing.entitlements.maxOrganizations,
      maxUsers: billing.entitlements.maxUsers,
      maxProducts: billing.entitlements.maxProducts,
    },
    checkout: {
      publicPlans,
      provider: provider.provider,
      providerConfigured: provider.configured,
      webhookConfigured,
      appBaseUrlConfigured,
      saleReady: Boolean(publicPlans > 0 && provider.configured && webhookConfigured && appBaseUrlConfigured),
      webhookEndpoint: "/api/billing/webhooks/mercado-pago",
      authority: "provider-confirmed-backend-only",
    },
  })
}
