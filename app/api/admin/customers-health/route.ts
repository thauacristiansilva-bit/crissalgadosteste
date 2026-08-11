import { NextResponse } from "next/server"
import {
  getCustomerAccounts,
  getCustomers as getLegacyCustomers,
} from "@/lib/db"
import {
  getTenantCustomersStats,
} from "@/lib/customer-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão multiempresa inválida." },
      { status: 401 },
    )
  }

  try {
    const stats = await getTenantCustomersStats(
      session.organizationId,
    )

    const mirrorEnabled =
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )

    let legacy:
      | {
          accounts: number
          crmCustomers: number
        }
      | null = null

    if (mirrorEnabled) {
      const [accounts, customers] = await Promise.all([
        getCustomerAccounts({ includeInactive: true }),
        getLegacyCustomers(),
      ])

      legacy = {
        accounts: accounts.length,
        crmCustomers: customers.length,
      }
    }

    const countsMatch =
      !legacy ||
      (legacy.accounts === stats.accounts &&
        legacy.crmCustomers === stats.crmCustomers)

    return NextResponse.json({
      ok: stats.ready && countsMatch,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      role: session.role,
      customers: stats,
      transition: {
        legacyMirrorEnabled: mirrorEnabled,
        legacy,
        countsMatch,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os clientes.",
      },
      { status: 503 },
    )
  }
}
