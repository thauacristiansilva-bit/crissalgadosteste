import { NextResponse } from "next/server"
import { getPostgresPool } from "@/lib/postgres"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageSecurity } from "@/lib/admin-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const expectedTables = [
  "sf_users",
  "sf_organizations",
  "sf_memberships",
  "sf_organization_settings",
  "sf_audit_log",
  "sf_schema_migrations",
]

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
    const result = await getPostgresPool().query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `, [expectedTables])

    const available = new Set(result.rows.map((row) => row.table_name))
    const missingCount = expectedTables.filter((table) => !available.has(table)).length

    return NextResponse.json({
      ok: missingCount === 0,
      expectedCount: expectedTables.length,
      missingCount,
    })
  } catch (error) {
    console.error(
      "[SaborFlow] Falha ao consultar estrutura multiempresa:",
      error instanceof Error ? error.message : error,
    )

    return NextResponse.json(
      { ok: false, error: "Não foi possível consultar a estrutura do banco." },
      { status: 503 },
    )
  }
}
