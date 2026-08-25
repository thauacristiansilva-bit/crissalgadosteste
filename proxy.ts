import {
  NextRequest,
  NextResponse,
} from "next/server"
import {
  browserRequestLooksCrossSite,
  requestIsSameOrigin,
} from "@/lib/security/request-security"

const COOKIE = "saborflow_store_slug"
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const CROSS_ORIGIN_API_EXCEPTIONS = [
  "/api/billing/webhooks/mercado-pago",
  "/api/integrations/webhooks/",
  "/api/internal/integrations/process",
]

function normalizeHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
}

function isCrossOriginApiException(pathname: string) {
  return CROSS_ORIGIN_API_EXCEPTIONS.some((prefix) =>
    pathname.startsWith(prefix),
  )
}

function protectStateChangingApiRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    !pathname.startsWith("/api/") ||
    SAFE_METHODS.has(request.method.toUpperCase()) ||
    isCrossOriginApiException(pathname)
  ) {
    return null
  }

  // Bloqueia requisições de browser vindas de outro site/subdomínio.
  // Chamadas servidor-servidor sem Fetch Metadata continuam dependendo
  // da autenticação/assinatura do próprio endpoint.
  if (browserRequestLooksCrossSite(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403 },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403 },
    )
  }

  return null
}

export function proxy(request: NextRequest) {
  const blocked = protectStateChangingApiRequest(request)
  if (blocked) return blocked

  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  const match = pathname.match(
    /^\/loja\/([^/]+)(?:\/|$)/,
  )

  if (match?.[1]) {
    response.cookies.set(
      COOKIE,
      decodeURIComponent(match[1]),
      {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
      },
    )

    return response
  }

  // Na raiz do domínio compartilhado do Railway, voltar para a loja
  // padrão do deployment. Domínios customizados usam o próprio host.
  if (pathname === "/") {
    const host = normalizeHost(
      request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        "",
    )

    const railway = normalizeHost(
      process.env.RAILWAY_PUBLIC_DOMAIN || "",
    )

    if (host && railway && host === railway) {
      response.cookies.delete(COOKIE)
    }
  }

  return response
}

export const config = {
  matcher: ["/", "/loja/:path*", "/api/:path*"],
}
