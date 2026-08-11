import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getAdminSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  return NextResponse.json(
    await getTenantAwareAdminData(session),
  )
}
