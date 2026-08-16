import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth"
import { getOperationalAccessForSession } from "@/lib/operational-rbac"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getAdminSession()

  if (!session || session.mode !== "tenant") {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const access = await getOperationalAccessForSession(session)

  return NextResponse.json(
    await getTenantAwareAdminData(session, access.permissions),
  )
}
