import { NextResponse } from "next/server"
import {
  createTenantCategory,
  getTenantCategories,
} from "@/lib/catalog-db"
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

  return NextResponse.json({
    categories: await getTenantCategories(session.organizationId),
  })
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

    const category = await createTenantCategory(
      session.organizationId,
      body?.name || "",
    )

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
