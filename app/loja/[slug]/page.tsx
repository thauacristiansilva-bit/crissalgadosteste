import { notFound } from "next/navigation"
import { Storefront } from "@/components/store/storefront"
import {
  resolveServerPublicOrganization,
} from "@/lib/public-tenant"
import {
  getPublicStoreForOrganization,
} from "@/lib/public-store-db"

export const dynamic = "force-dynamic"

export default async function StoreSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const organization =
    await resolveServerPublicOrganization(
      decodeURIComponent(slug),
    )

  if (!organization) notFound()

  const store =
    await getPublicStoreForOrganization(
      organization,
    )

  return <Storefront {...store} />
}
