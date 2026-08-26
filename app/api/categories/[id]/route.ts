import { NextResponse } from "next/server"
import { updateTenantCategory } from "@/lib/catalog-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
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
    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    const result = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => updateTenantCategory(session.organizationId, numericId, body),
      "tenant-session",
    )

    if (!result) {
      return NextResponse.json(
        { error: "Categoria não encontrada." },
        { status: 404 },
      )
    }

    return NextResponse.json({ category: result.category })
  } catch (error) {
    console.error("[SaborFlow] Falha ao atualizar categoria PostgreSQL:", error)
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
