import { notFound } from "next/navigation"
import { Storefront } from "@/components/store/storefront"
import { resolveServerPublicOrganization } from "@/lib/public-tenant"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"

export const dynamic = "force-dynamic"

export default async function StoreCatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const organization = await resolveServerPublicOrganization(decodeURIComponent(slug))
  if (!organization) notFound()

  const store = await getPublicStoreForOrganization(organization)
  const basePath = `/loja/${encodeURIComponent(organization.slug)}`

  return <Storefront {...store} pageMode="catalog" publicBasePath={basePath} />
}
