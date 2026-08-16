import { redirect } from "next/navigation"
import { CourierWorkspace } from "@/components/operational/courier-workspace"
import { getCourierWorkspaceSnapshot } from "@/lib/delivery-dispatch-db"
import {
  canAccessOperationalWorkspace,
  getDefaultOperationalPath,
} from "@/lib/operational-home"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

export default async function CourierPage() {
  const session = await getVerifiedTenantSession()
  if (!session) redirect("/login")

  if (
    !canAccessOperationalWorkspace(
      "courier",
      session.role,
      session.operationalPermissions,
    )
  ) {
    redirect(
      getDefaultOperationalPath(
        session.role,
        session.operationalPermissions,
      ),
    )
  }

  const dispatch = await runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    () =>
      getCourierWorkspaceSnapshot({
        organizationId: session.organizationId,
        userId: session.userId,
        role: session.role,
        permissions: session.operationalPermissions,
      }),
    "tenant-session",
  )

  return (
    <CourierWorkspace
      organizationName={session.organizationName}
      initialOrders={dispatch.orders}
      selfMode={dispatch.selfMode}
      courier={dispatch.courier}
    />
  )
}
