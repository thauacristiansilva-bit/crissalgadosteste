import { headers } from "next/headers"
import { Storefront } from "@/components/store/storefront"
import { MarketingHome } from "@/components/marketing/marketing-home"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"
import { getPublicOrganizationByDomain, normalizePublicDomain } from "@/lib/organization-db"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const requestHeaders = await headers()
  const host = normalizePublicDomain(
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "",
  )

  // Domínio próprio de uma loja continua abrindo o storefront na raiz.
  // No domínio compartilhado/plataforma, a raiz passa a ser o site institucional.
  if (host) {
    const organization = await getPublicOrganizationByDomain(host).catch(() => null)
    if (organization) {
      const store = await getPublicStoreForOrganization(organization)
      return <Storefront {...store} />
    }
  }

  return <MarketingHome />
}
