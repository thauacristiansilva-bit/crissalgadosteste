import { Storefront } from "@/components/store/storefront"
import { getPublicStore } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const store = await getPublicStore()
  return <Storefront {...store} />
}
