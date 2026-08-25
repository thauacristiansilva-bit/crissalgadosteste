import { NextResponse } from "next/server"
import { checkPostgresConnection } from "@/lib/postgres"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageSecurity } from "@/lib/admin-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageSecurity(session.role, session.operationalPermissions)) {
    return NextResponse.json(
      { ok: false, error: "Seu perfil não pode acessar diagnósticos de segurança." },
      { status: 403 },
    )
  }

  try {
    const health = await checkPostgresConnection()

    return NextResponse.json({
      ok: health.ok,
      database: health.ok ? "connected" : "unavailable",
      checkedAt: health.checkedAt,
    })
  } catch (error) {
    console.error(
      "[SaborFlow] Falha no teste do PostgreSQL:",
      error instanceof Error ? error.message : error,
    )

    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
        error: "Não foi possível conectar ao PostgreSQL.",
      },
      { status: 503 },
    )
  }
}
