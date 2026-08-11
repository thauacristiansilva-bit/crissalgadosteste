import { NextResponse } from "next/server"
import {
  getStaffMembers as getLegacyStaffMembers,
  getSettings as getLegacySettings,
} from "@/lib/db"
import {
  getTenantDomains,
  getTenantRuntimeStats,
  getTenantSettings,
  getTenantStaffMembers,
} from "@/lib/organization-db"
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
      {
        ok: false,
        error: "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  try {
    const [
      stats,
      settings,
      staffMembers,
      domains,
    ] = await Promise.all([
      getTenantRuntimeStats(
        session.organizationId,
      ),
      getTenantSettings(
        session.organizationId,
      ),
      getTenantStaffMembers(
        session.organizationId,
        { includeInactive: true },
      ),
      getTenantDomains(
        session.organizationId,
      ),
    ])

    const isCurrent =
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )

    let legacy:
      | {
          storeName: string
          staff: number
        }
      | null = null

    if (isCurrent) {
      const [
        legacySettings,
        legacyStaff,
      ] = await Promise.all([
        getLegacySettings(),
        getLegacyStaffMembers(),
      ])

      legacy = {
        storeName: legacySettings.storeName,
        staff: legacyStaff.length,
      }
    }

    const countsMatch =
      !legacy ||
      (legacy.storeName ===
        settings?.storeName &&
        legacy.staff ===
          staffMembers.length)

    return NextResponse.json({
      ok:
        stats.ready &&
        Boolean(settings) &&
        countsMatch,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      role: session.role,
      runtime: stats,
      settings: settings
        ? {
            storeName: settings.storeName,
            city: settings.city,
            state: settings.state,
          }
        : null,
      staff: {
        count: staffMembers.length,
      },
      domains,
      publicPaths: {
        slug: `/loja/${session.organizationSlug}`,
        railwayDomain:
          process.env.RAILWAY_PUBLIC_DOMAIN ||
          null,
      },
      transition: {
        legacyMirrorEnabled: isCurrent,
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
            : "Não foi possível consultar o runtime da empresa.",
      },
      { status: 503 },
    )
  }
}
