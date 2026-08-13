import { redirect } from "next/navigation"
import { FoodOperationsDashboard } from "@/components/admin/food-operations-dashboard"
import { canAccessFoodOperations } from "@/lib/food-operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function FoodOperationsPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")
  if (!canAccessFoodOperations(session)) redirect("/admin")

  return <FoodOperationsDashboard currentOrganizationName={session.organizationName} />
}
