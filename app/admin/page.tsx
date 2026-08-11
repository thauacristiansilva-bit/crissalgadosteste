import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { getAdminEmail, getAdminSession } from "@/lib/auth"
import { getAdminData } from "@/lib/db"
import {
  getTenantCategories,
  getTenantProducts,
  isTenantCatalogReady,
} from "@/lib/catalog-db"
import { membershipExists } from "@/lib/tenant-context"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect("/login")

  const initialData = await getAdminData()

  if (session.mode === "tenant") {
    try {
      const activeMembership = await membershipExists(
        session.userId,
        session.organizationId,
      )

      if (
        activeMembership &&
        (await isTenantCatalogReady(session.organizationId))
      ) {
        const [products, categories] = await Promise.all([
          getTenantProducts(session.organizationId, {
            includeInactive: true,
          }),
          getTenantCategories(session.organizationId, {
            includeInactive: true,
          }),
        ])

        initialData.products = products
        initialData.categories = categories
      }
    } catch (error) {
      // Compatibilidade de rollout: antes da migration/importação,
      // o painel continua usando o catálogo legado.
      console.error(
        "[SaborFlow] Catálogo PostgreSQL indisponível; usando legado:",
        error instanceof Error ? error.message : error,
      )
    }
  }

  return (
    <AdminDashboard
      adminEmail={session.email || getAdminEmail()}
      initialData={initialData}
    />
  )
}
