function firstForwardedValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() || ""
}

function normalizedOrigin(value: string | null | undefined) {
  if (!value) return ""
  try {
    return new URL(value).origin
  } catch {
    return ""
  }
}

function isLocalHost(origin: string) {
  if (!origin) return false
  try {
    const hostname = new URL(origin).hostname.toLowerCase()
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return false
  }
}

/**
 * Resolve a URL base that is safe to show to users.
 *
 * Railway/other reverse proxies can make request.url look like localhost even
 * when the public request arrived through the production domain. Explicit
 * APP_BASE_URL wins, followed by forwarded headers and RAILWAY_PUBLIC_DOMAIN.
 */
export function resolvePublicAppOrigin(request: Request) {
  const configured = normalizedOrigin(process.env.APP_BASE_URL?.trim())
  if (configured) return configured

  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  )
  const host = forwardedHost || firstForwardedValue(request.headers.get("host"))
  const forwardedProto = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  )

  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : "https"

  if (host) {
    const forwardedOrigin = normalizedOrigin(`${protocol}://${host}`)
    if (forwardedOrigin && !isLocalHost(forwardedOrigin)) {
      return forwardedOrigin
    }
  }

  const railwayDomain = firstForwardedValue(process.env.RAILWAY_PUBLIC_DOMAIN)
  if (railwayDomain) {
    const railwayOrigin = normalizedOrigin(`https://${railwayDomain}`)
    if (railwayOrigin) return railwayOrigin
  }

  const runtimeOrigin = normalizedOrigin(request.url)
  if (runtimeOrigin && (!isLocalHost(runtimeOrigin) || process.env.NODE_ENV !== "production")) {
    return runtimeOrigin
  }

  throw new Error(
    "APP_BASE_URL não está configurada com a URL pública da aplicação.",
  )
}
