import { redirect } from "next/navigation"
import { MigrationIntakePanel } from "@/components/admin/migration-intake-panel"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function ImportOldCatalogPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (session.role !== "owner") redirect("/admin")

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <MigrationIntakePanel />
      </div>
    </main>
  )
}
