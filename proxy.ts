import {
  NextRequest,
  NextResponse,
} from "next/server"

const COOKIE = "saborflow_store_slug"

function normalizeHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
}

export function proxy(request: NextRequest) {
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
  matcher: ["/", "/loja/:path*"],
}
