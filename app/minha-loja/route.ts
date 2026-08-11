import {
  NextResponse,
} from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export async function GET(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.redirect(
      new URL("/login", request.url),
    )
  }

  return NextResponse.redirect(
    new URL(
      `/loja/${encodeURIComponent(
        session.organizationSlug,
      )}`,
      request.url,
    ),
  )
}
