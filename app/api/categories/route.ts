import { NextResponse } from "next/server"
import {
  createCategory as createLegacyCategory,
  getCategories as getLegacyCategories,
  syncLegacyCategoryFromTenant,
} from "@/lib/db"
import {
  createTenantCategory,
  getTenantCategories,
  isCurrentDeploymentOrganization,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import { isAdminAuthenticated } from "@/lib/auth"

export async function GET() {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (
    session &&
    (await isTenantCatalogReady(session.organizationId).catch(() => false))
  ) {
    return NextResponse.json({
      categories: await getTenantCategories(session.organizationId),
    })
  }

  return NextResponse.json({
    categories: await getLegacyCategories(),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: string }
    | null

  try {
    const session = await getVerifiedTenantSession()
    const catalogReady =
      session &&
      (await isTenantCatalogReady(session.organizationId))

    if (!session || !catalogReady) {
      const category = await createLegacyCategory(body?.name || "")
      return NextResponse.json({ category }, { status: 201 })
    }

    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    const category = await createTenantCategory(
      session.organizationId,
      body?.name || "",
    )

    if (await isCurrentDeploymentOrganization(session.organizationId)) {
      await syncLegacyCategoryFromTenant(category)
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a categoria.",
      },
      { status: 400 },
    )
  }
}
