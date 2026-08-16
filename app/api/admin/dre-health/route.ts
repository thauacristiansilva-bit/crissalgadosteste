import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getTenantDreHealth } from "@/lib/dre-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canViewFinance } from "@/lib/tenant-permissions"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "A DRE exige uma sessão multiempresa válida." },
      { status: 409 },
    )
  }

  if (!canViewFinance(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar a DRE gerencial." },
      { status: 403 },
    )
  }

  try {
    return NextResponse.json(await getTenantDreHealth(session.organizationId))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: 13,
        error: error instanceof Error ? error.message : "Falha no health check da DRE.",
      },
      { status: 500 },
    )
  }
}
