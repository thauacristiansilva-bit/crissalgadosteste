function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || ""
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
  if (!value) return
  try {
    origins.add(new URL(value).origin)
  } catch {
    // Valores inválidos nunca autorizam a origem.
  }
}

function expectedOrigins(request: Request) {
  const origins = new Set<string>()
  addOrigin(origins, request.url)

  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host"))
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"))
  let runtimeProto = "https"
  try {
    runtimeProto = new URL(request.url).protocol.replace(":", "")
  } catch {}
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : runtimeProto

  if (host && (proto === "http" || proto === "https")) {
    addOrigin(origins, `${proto}://${host}`)
  }

  addOrigin(origins, process.env.APP_BASE_URL?.trim())
  addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL?.trim())
  return origins
}

export function foodOperationsRequestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    return expectedOrigins(request).has(new URL(origin).origin)
  } catch {
    return false
  }
}
