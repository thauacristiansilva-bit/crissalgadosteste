function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || ""
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function requestIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    firstForwardedValue(request.headers.get("x-forwarded-for")) ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 128)
}

export function requestTargetOrigin(request: Request) {
  const forwardedHost =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host"))
  const forwardedProto = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  )

  if (
    forwardedHost &&
    (forwardedProto === "https" || forwardedProto === "http")
  ) {
    return normalizeOrigin(`${forwardedProto}://${forwardedHost}`)
  }

  return normalizeOrigin(request.url)
}

export function requestIsSameOrigin(request: Request) {
  const target = requestTargetOrigin(request)
  if (!target) return false

  const origin = normalizeOrigin(request.headers.get("origin"))
  if (origin) return origin === target

  const referer = normalizeOrigin(request.headers.get("referer"))
  if (referer) return referer === target

  // Chamadas servidor-servidor e webhooks podem não enviar Origin/Referer.
  // Endpoints públicos ainda precisam de autenticação/assinatura própria.
  return true
}

export function browserRequestLooksCrossSite(request: Request) {
  const site = request.headers.get("sec-fetch-site")?.toLowerCase().trim()
  return site === "cross-site" || site === "same-site"
}
