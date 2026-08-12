import { createHmac } from "node:crypto"

export function demoRequestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const address =
    forwarded ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  const secret = process.env.SESSION_SECRET?.trim() || "saborflow-demo-development"
  return createHmac("sha256", secret)
    .update(`demo-public:v1:${address}`)
    .digest("hex")
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || ""
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
  if (!value) return
  try {
    origins.add(new URL(value).origin)
  } catch {
    // Ignora valores inválidos de headers/variáveis; eles nunca autorizam a origem.
  }
}

function expectedRequestOrigins(request: Request) {
  const origins = new Set<string>()

  // Origem observada pelo runtime do Next.js.
  addOrigin(origins, request.url)

  // Em Railway/reverse proxies, request.url pode conter host/protocolo interno.
  // A origem pública chega nos headers forwarded e deve ser tratada como a
  // autoridade externa da própria requisição.
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"))
  const host = forwardedHost || firstForwardedValue(request.headers.get("host"))
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"))
  const runtimeProtocol = (() => {
    try {
      return new URL(request.url).protocol.replace(":", "")
    } catch {
      return "https"
    }
  })()
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : runtimeProtocol

  if (host && (protocol === "http" || protocol === "https")) {
    addOrigin(origins, `${protocol}://${host}`)
  }

  // Quando configurado para billing, APP_BASE_URL também é uma origem pública
  // explícita da aplicação e pode validar chamadas same-origin.
  addOrigin(origins, process.env.APP_BASE_URL?.trim())

  return origins
}

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  let normalizedOrigin: string
  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    return false
  }

  return expectedRequestOrigins(request).has(normalizedOrigin)
}
