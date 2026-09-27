import { NextResponse } from "next/server"
import { getSuperadminAccess } from "@/lib/superadmin-auth"
import { getPostgresPool } from "@/lib/postgres"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await getSuperadminAccess())) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  try {
    const result = await getPostgresPool().query<{
      total: string; inicio: string; planos: string; demo: string
    }>(`
      SELECT COUNT(DISTINCT session_id)::text AS total,
             COUNT(DISTINCT session_id) FILTER (WHERE page = 'inicio')::text AS inicio,
             COUNT(DISTINCT session_id) FILTER (WHERE page = 'planos')::text AS planos,
             COUNT(DISTINCT session_id) FILTER (WHERE page = 'demo')::text AS demo
      FROM sf_platform_marketing_visits
      WHERE visited_on >= (now() AT TIME ZONE 'America/Fortaleza')::date - 29
    `)
    const row = result.rows[0]
    return NextResponse.json({ periodDays: 30, total: Number(row?.total || 0), inicio: Number(row?.inicio || 0), planos: Number(row?.planos || 0), demo: Number(row?.demo || 0) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[marketing-visits] Não foi possível carregar os indicadores.", error)
    return NextResponse.json({ error: "Contador ainda não instalado no banco." }, { status: 503 })
  }
}
