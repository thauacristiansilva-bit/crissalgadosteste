import { NextResponse } from "next/server"
import { getSuperadminAccess } from "@/lib/superadmin-auth"
import { getPostgresPool } from "@/lib/postgres"

export const dynamic = "force-dynamic"

export async function GET() {
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })

  const result = await getPostgresPool().query<{
    platform_admins: string
    support_cases: string
    commercial_coupons: string
    admin_actions: string
    pending_registrations: string
    finance_entries: string
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM sf_platform_admins WHERE status = 'active') AS platform_admins,
      (SELECT COUNT(*)::text FROM sf_support_cases WHERE status IN ('open','pending')) AS support_cases,
      (SELECT COUNT(*)::text FROM sf_commercial_coupons WHERE active = true) AS commercial_coupons,
      (SELECT COUNT(*)::text FROM sf_platform_admin_actions) AS admin_actions,
      (SELECT COUNT(*)::text FROM sf_platform_registration_reviews WHERE status = 'pending') AS pending_registrations,
      (SELECT COUNT(*)::text FROM sf_platform_finance_entries WHERE status <> 'canceled') AS finance_entries
  `)
  const row = result.rows[0]

  return NextResponse.json({
    ok: true,
    phase: "18.1-superadmin-operations-finance",
    schemaReady: true,
    access: { email: access.email, role: access.role, platformAdminId: access.platformAdminId },
    controlPlane: {
      activePlatformAdmins: Number(row?.platform_admins || 0),
      openSupportCases: Number(row?.support_cases || 0),
      activeCommercialCoupons: Number(row?.commercial_coupons || 0),
      auditedAdminActions: Number(row?.admin_actions || 0),
      pendingRegistrations: Number(row?.pending_registrations || 0),
      platformFinanceEntries: Number(row?.finance_entries || 0),
    },
    boundaries: {
      tenantAdminIsNotPlatformAdmin: true,
      legacySessionAllowed: false,
      browserCannotSelfGrant: true,
      billingProviderAuthorityPreserved: true,
      registrationApprovalRequiredToPublish: true,
      platformFinanceSeparatedFromTenantFinance: true,
      contractedMrrIsNotRecognizedRevenue: true,
    },
  })
}
