import { NextResponse } from "next/server"
import { resolvePublicAppOrigin } from "@/lib/public-origin"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

function isLocalOrigin(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return true
  }
}

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const publicOrigin = resolvePublicAppOrigin(request)
    const storeUrl = new URL(
      `/loja/${encodeURIComponent(session.organizationSlug)}`,
      publicOrigin,
    ).toString()

    const localOrigin = isLocalOrigin(publicOrigin)

    return NextResponse.json(
      {
        ok: !localOrigin,
        phase: "25.7.4-public-store-origin",
        organization: {
          id: session.organizationId,
          name: session.organizationName,
          slug: session.organizationSlug,
        },
        publicUrls: {
          origin: publicOrigin,
          storeUrl,
          appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL?.trim()),
          railwayPublicDomainConfigured: Boolean(
            process.env.RAILWAY_PUBLIC_DOMAIN?.trim(),
          ),
          localOrigin,
        },
        capabilities: {
          myStoreRedirectUsesPublicOrigin: true,
          loginRedirectUsesPublicOrigin: true,
          forwardedProxyHeadersSupported: true,
          railwayPublicDomainFallbackSupported: true,
          localhostBlockedInProductionResolver: true,
        },
      },
      { status: localOrigin ? 503 : 200 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "25.7.4-public-store-origin",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar os links públicos.",
      },
      { status: 503 },
    )
  }
}
