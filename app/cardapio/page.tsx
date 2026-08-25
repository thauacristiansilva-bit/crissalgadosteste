import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { Storefront } from "@/components/store/storefront"
import { getPublicOrganizationByDomain } from "@/lib/organization-db"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"
import { hostFromHeaders, isPlatformHost } from "@/lib/public-host"

export const dynamic = "force-dynamic"

export default async function CustomDomainCatalogPage() {
  const host = hostFromHeaders(await headers())
  if (!host || isPlatformHost(host)) notFound()

  const organization = await getPublicOrganizationByDomain(host).catch(() => null)
  if (!organization) notFound()

  const store = await getPublicStoreForOrganization(organization)
  return <Storefront {...store} pageMode="catalog" publicBasePath="" />
}
