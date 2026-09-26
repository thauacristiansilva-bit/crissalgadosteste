import { redirect } from "next/navigation"
import { getVerifiedTenantSession, canManageCatalog } from "@/lib/tenant-access"
import { canManageOrganizationSettings } from "@/lib/tenant-permissions"
import { AiLandingPreview } from "@/components/admin/ai-landing-preview"

export const dynamic = "force-dynamic"

export default async function AiPreviewPage() {
  const session = await getVerifiedTenantSession()
  if (!session || !canManageCatalog(session.role) || !canManageOrganizationSettings(session.role)) redirect("/login")
  return <AiLandingPreview />
}
