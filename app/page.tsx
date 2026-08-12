import { headers } from "next/headers"
import { Storefront } from "@/components/store/storefront"
import { MarketingHome } from "@/components/marketing/marketing-home"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"
import { getPublicOrganizationByDomain, normalizePublicDomain } from "@/lib/organization-db"

export const dynamic = "force-dynamic"

function hostnameFromUrl(value?: string | null) {
  if (!value) return ""
  try {
    return normalizePublicDomain(new URL(value).hostname)
  } catch {
    return ""
  }
}

function isPlatformHost(host: string) {
  if (!host) return true

  // O domínio público gerado pelo Railway pertence à plataforma SaborFlow,
  // nunca a uma loja. Isso evita que um vínculo legado em sf_organization_domains
  // faça a raiz institucional voltar a exibir um storefront.
  if (host.endsWith(".up.railway.app")) return true

  if (host === "localhost" || host === "127.0.0.1") return true

  const platformHosts = new Set(
    [
      hostnameFromUrl(process.env.APP_BASE_URL),
      hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      normalizePublicDomain(process.env.RAILWAY_PUBLIC_DOMAIN || ""),
    ].filter(Boolean),
  )

  return platformHosts.has(host)
}

export default async function HomePage() {
  const requestHeaders = await headers()
  const host = normalizePublicDomain(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "",
  )

  // A raiz da plataforma é sempre institucional. Apenas um domínio próprio
  // de loja, diferente do domínio da plataforma, pode renderizar storefront na raiz.
  if (host && !isPlatformHost(host)) {
    const organization = await getPublicOrganizationByDomain(host).catch(() => null)
    if (organization) {
      const store = await getPublicStoreForOrganization(organization)
      return <Storefront {...store} />
    }
  }

  return <MarketingHome />
}
