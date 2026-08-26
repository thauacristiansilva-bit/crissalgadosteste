import { timingSafeEqual } from "node:crypto"
import { normalizePublicDomain } from "@/lib/organization-db"

function hostnameFromUrl(value?: string | null) {
  if (!value) return ""
  try {
    return normalizePublicDomain(new URL(value).hostname)
  } catch {
    return ""
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isPlatformHost(host: string) {
  const clean = normalizePublicDomain(host)
  if (!clean) return true

  if (clean.endsWith(".up.railway.app")) return true
  if (clean === "localhost" || clean === "127.0.0.1") return true

  const platformHosts = new Set(
    [
      hostnameFromUrl(process.env.APP_BASE_URL),
      hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      normalizePublicDomain(process.env.RAILWAY_PUBLIC_DOMAIN || ""),
      normalizePublicDomain(process.env.STOREFRONT_ROOT_DOMAIN || ""),
    ].filter(Boolean),
  )

  return platformHosts.has(clean)
}

export function hostFromHeaders(requestHeaders: { get(name: string): string | null }) {
  const edgeHost = normalizePublicDomain(
    requestHeaders.get("x-saborflow-edge-host") || "",
  )
  const edgeToken = requestHeaders.get("x-saborflow-edge-token") || ""
  const expectedToken = process.env.SABORFLOW_EDGE_TOKEN || ""

  // Domínios de clientes passam por um Worker Cloudflare. Só confiamos no
  // hostname original quando o Worker prova que conhece o segredo privado.
  if (
    edgeHost &&
    edgeToken &&
    expectedToken &&
    safeEqual(edgeToken, expectedToken)
  ) {
    return edgeHost
  }

  return normalizePublicDomain(
    requestHeaders.get("host") || requestHeaders.get("x-forwarded-host") || "",
  )
}
