import { NextResponse } from "next/server"
import {
  createTenantCategory,
  getTenantCategories,
} from "@/lib/catalog-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  canManageCatalog,
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export async function GET() {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const categories = await runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    () => getTenantCategories(session.organizationId),
    "tenant-session",
  )

  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: string }
    | null

  try {
    if (!canManageCatalog(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode alterar o catálogo." },
        { status: 403 },
      )
    }

    const category = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => createTenantCategory(session.organizationId, body?.name || ""),
      "tenant-session",
    )

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error("[SaborFlow] Falha ao criar categoria PostgreSQL:", error)
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
