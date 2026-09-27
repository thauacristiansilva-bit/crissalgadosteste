import { DemoLauncher } from "@/components/demo/demo-launcher"
import { MarketingVisitTracker } from "@/components/marketing/marketing-visit-tracker"

export const dynamic = "force-dynamic"

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>
}) {
  const params = await searchParams
  return <><MarketingVisitTracker page="demo" /><DemoLauncher expired={params.expired === "1"} /></>
}
