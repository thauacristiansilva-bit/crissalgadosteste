import { NextResponse } from "next/server"
import { getPostgresPool } from "@/lib/postgres"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 })
  const raw = await request.text()
  if (raw.length > 250) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  let data: { page?: unknown; sessionId?: unknown } | null = null
  try { data = JSON.parse(raw) } catch { /* Requisição inválida. */ }
  if (!data || !["inicio", "planos", "demo"].includes(String(data.page)) ||
      typeof data.sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.sessionId)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  }
  try {
    await getPostgresPool().query(
      `INSERT INTO sf_platform_marketing_visits (page, session_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [data.page, data.sessionId],
    )
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[marketing-visits] Não foi possível registrar a visita.", error)
    return NextResponse.json({ error: "Contador indisponível." }, { status: 503 })
  }
}
