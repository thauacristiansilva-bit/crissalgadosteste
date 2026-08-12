import { DemoLauncher } from "@/components/demo/demo-launcher"

export const dynamic = "force-dynamic"

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>
}) {
  const params = await searchParams
  return <DemoLauncher expired={params.expired === "1"} />
}
