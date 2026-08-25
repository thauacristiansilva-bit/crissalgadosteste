import { normalizePublicDomain } from "@/lib/organization-db"

function hostnameFromUrl(value?: string | null) {
  if (!value) return ""
  try {
    return normalizePublicDomain(new URL(value).hostname)
  } catch {
    return ""
  }
}

export function isPlatformHost(host: string) {
  const clean = normalizePublicDomain(host)
  if (!clean) return true

  // O domínio gerado pelo Railway é da plataforma, nunca de uma loja.
  if (clean.endsWith(".up.railway.app")) return true
  if (clean === "localhost" || clean === "127.0.0.1") return true

  const platformHosts = new Set(
    [
      hostnameFromUrl(process.env.APP_BASE_URL),
      hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      normalizePublicDomain(process.env.RAILWAY_PUBLIC_DOMAIN || ""),
    ].filter(Boolean),
  )

  return platformHosts.has(clean)
}

export function hostFromHeaders(requestHeaders: { get(name: string): string | null }) {
  return normalizePublicDomain(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "",
  )
}
