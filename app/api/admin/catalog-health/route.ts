import { NextResponse } from "next/server"
import {
  getTenantCatalogStats,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getCategories as getLegacyCategories,
  getProducts as getLegacyProducts,
} from "@/lib/db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

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
    const stats = await getTenantCatalogStats(session.organizationId)
    const mirrorEnabled = await isCurrentDeploymentOrganization(
      session.organizationId,
    )

    let legacy: { categories: number; products: number } | null = null

    if (mirrorEnabled) {
      const [categories, products] = await Promise.all([
        getLegacyCategories({ includeInactive: true }),
        getLegacyProducts({ includeInactive: true }),
      ])

      legacy = {
        categories: categories.length,
        products: products.length,
      }
    }

    return NextResponse.json({
      ok: stats.ready,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      role: session.role,
      catalog: stats,
      transition: {
        legacyMirrorEnabled: mirrorEnabled,
        legacy,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o catálogo.",
      },
      { status: 503 },
    )
  }
}
