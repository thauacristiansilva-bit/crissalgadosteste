import { redirect } from "next/navigation"
import { LegalAcceptanceForm } from "@/components/legal/legal-acceptance-form"
import { hasCurrentLegalAcceptance } from "@/lib/legal-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function LegalAcceptancePage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (await hasCurrentLegalAcceptance(session.userId)) redirect("/admin")

  return (
    <main className="min-h-screen bg-[#fffaf3] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm font-black text-orange-700">SaborFlow</a>
        <LegalAcceptanceForm />
      </div>
    </main>
  )
}
