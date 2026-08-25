import { headers } from "next/headers"
import { MarketingHome } from "@/components/marketing/marketing-home"
import { StoreLandingPage } from "@/components/store/store-landing-page"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"
import { getPublicOrganizationByDomain } from "@/lib/organization-db"
import { hostFromHeaders, isPlatformHost } from "@/lib/public-host"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const requestHeaders = await headers()
  const host = hostFromHeaders(requestHeaders)

  // A raiz da plataforma continua institucional. Em domínio próprio verificado,
  // a raiz passa a ser a landing page pública da empresa.
  if (host && !isPlatformHost(host)) {
    const organization = await getPublicOrganizationByDomain(host).catch(() => null)
    if (organization) {
      const store = await getPublicStoreForOrganization(organization)
      return (
        <StoreLandingPage
          products={store.products}
          settings={store.settings}
          openNow={store.openNow}
          basePath="/"
        />
      )
    }
  }

  return <MarketingHome />
}
