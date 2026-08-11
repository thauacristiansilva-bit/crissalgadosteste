import { NextResponse } from "next/server"
import {
  syncLegacyCategoryFromTenant,
  updateCategory as updateLegacyCategory,
} from "@/lib/db"
import {
  isCurrentDeploymentOrganization,
  isTenantCatalogReady,
  updateTenantCategory,
} from "@/lib/catalog-db"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import { isAdminAuthenticated } from "@/lib/auth"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as
    | { name?: string; active?: boolean; sortOrder?: number }
    | null

  if (!Number.isInteger(numericId) || !body) {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 },
    )
  }

  try {
    const session = await getVerifiedTenantSession()
    const catalogReady =
      session &&
      (await isTenantCatalogReady(session.organizationId))

    if (!session || !catalogReady) {
      const category = await updateLegacyCategory(numericId, body)

      if (!category) {
        return NextResponse.json(
          { error: "Categoria não encontrada." },
          { status: 404 },
        )
      }

      return NextResponse.json({ category })
    }

    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    const result = await updateTenantCategory(
      session.organizationId,
      numericId,
      body,
    )

    if (!result) {
      return NextResponse.json(
        { error: "Categoria não encontrada." },
        { status: 404 },
      )
    }

    if (await isCurrentDeploymentOrganization(session.organizationId)) {
      await syncLegacyCategoryFromTenant(
        result.category,
        result.previousName,
      )
    }

    return NextResponse.json({ category: result.category })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a categoria.",
      },
      { status: 400 },
    )
  }
}
