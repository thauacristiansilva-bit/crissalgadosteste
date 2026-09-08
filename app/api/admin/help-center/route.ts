import { NextResponse } from "next/server"
import {
  listHelpCenterArticles,
  listHelpCenterCategories,
} from "@/lib/help-center-db"
import { permissionListHas } from "@/lib/operational-permissions"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

export async function GET(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Não autorizado.",
      },
      {
        status: 401,
        headers: responseHeaders(),
      },
    )
  }

  if (
    !permissionListHas(
      session.operationalPermissions,
      "dashboard.view",
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Seu perfil não pode acessar a Central de Ajuda.",
      },
      {
        status: 403,
        headers: responseHeaders(),
      },
    )
  }

  const url =
    new URL(request.url)

  const query =
    (url.searchParams.get("q") || "")
      .trim()
      .slice(0, 500)

  const category =
    (url.searchParams.get("category") || "")
      .trim()
      .slice(0, 100)

  try {
    const [
      categories,
      articles,
    ] = await Promise.all([
      listHelpCenterCategories(
        "admin",
      ),
      listHelpCenterArticles({
        audience: "admin",
        query,
        categorySlug:
          category,
        limit: 40,
      }),
    ])

    return NextResponse.json(
      {
        ok: true,
        query,
        category,
        categories,
        articles,
      },
      {
        headers:
          responseHeaders(),
      },
    )
  } catch (error) {
    console.error(
      "Falha ao carregar Central de Ajuda.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          "Não foi possível carregar a Central de Ajuda.",
      },
      {
        status: 500,
        headers: responseHeaders(),
      },
    )
  }
}