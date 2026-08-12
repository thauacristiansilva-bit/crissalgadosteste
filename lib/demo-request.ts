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

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}
