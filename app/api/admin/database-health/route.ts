import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { checkPostgresConnection } from "@/lib/postgres"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 },
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
