import { NextResponse } from "next/server"
import { resolvePublicAppOrigin } from "@/lib/public-origin"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  let publicOrigin = ""

  try {
    publicOrigin = resolvePublicAppOrigin(request)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível resolver a URL pública da aplicação.",
      },
      { status: 503 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.redirect(new URL("/login", publicOrigin))
  }

  return NextResponse.redirect(
    new URL(
      `/loja/${encodeURIComponent(session.organizationSlug)}`,
      publicOrigin,
    ),
  )
}
