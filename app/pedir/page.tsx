import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { Storefront } from "@/components/store/storefront"
import { getPublicOrganizationForHost } from "@/lib/organization-db"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"
import { hostFromHeaders, isPlatformHost } from "@/lib/public-host"

export const dynamic = "force-dynamic"

export default async function CustomDomainOrderPage() {
  const host = hostFromHeaders(await headers())
  if (!host || isPlatformHost(host)) notFound()

  const organization = await getPublicOrganizationForHost(host).catch(() => null)
  if (!organization) notFound()

  const store = await getPublicStoreForOrganization(organization)
  return <Storefront {...store} pageMode="order" publicBasePath="" />
}
