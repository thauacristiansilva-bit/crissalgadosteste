import { NextResponse } from "next/server"
import { canAccessCrm, getCrmOverview } from "@/lib/crm-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessCrm(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso ao CRM e fidelidade." }, { status: 403 })
  }

  try {
    return NextResponse.json(await getCrmOverview(session))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar o CRM." },
      { status: 503 },
    )
  }
}
