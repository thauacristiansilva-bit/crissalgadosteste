import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getPostgresPool } from "@/lib/postgres"

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
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 },
    )
  }

  try {
    const result = await getPostgresPool().query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'sf_%'
      ORDER BY table_name
    `)

    const tables = result.rows.map((row) => row.table_name)
    const missing = expectedTables.filter((table) => !tables.includes(table))

    return NextResponse.json({
      ok: missing.length === 0,
      tables,
      expectedTables,
      missing,
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
