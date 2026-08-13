import { NextResponse } from "next/server"
import { canAccessIntegrations, getIntegrationsOverview } from "@/lib/integrations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso às integrações." }, { status: 403 })
  }
  try {
    return NextResponse.json(await getIntegrationsOverview(session))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar as integrações." },
      { status: 503 },
    )
  }
}
