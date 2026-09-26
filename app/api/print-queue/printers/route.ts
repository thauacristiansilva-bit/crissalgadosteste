import { NextResponse } from "next/server"
import { authenticatePrintAgent } from "@/lib/organization-security-db"
import { getPostgresPool } from "@/lib/postgres"
import { assertDemoActionAllowed } from "@/lib/demo-policy"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const token = request.headers.get("x-print-token")?.trim() || ""
  if (!token || token.length > 512) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const agent = await authenticatePrintAgent(token)
  if (!agent) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  await assertDemoActionAllowed(agent.organizationId, "external-print")
  const raw = await request.text()
  if (raw.length > 15_000) return NextResponse.json({ error: "Lista muito grande." }, { status: 413 })
  let input: unknown
  try { input = JSON.parse(raw) } catch { return NextResponse.json({ error: "Lista inválida." }, { status: 400 }) }
  const entries = Array.isArray((input as { printers?: unknown })?.printers) ? (input as { printers: unknown[] }).printers : []
  if (entries.length > 50) return NextResponse.json({ error: "Impressoras demais." }, { status: 400 })
  const printers = entries.map(item => {
    const data = item && typeof item === "object" ? item as { name?: unknown; port?: unknown } : {}
    return { name: String(data.name || "").trim().slice(0, 120), port: String(data.port || "").trim().slice(0, 120) }
  }).filter(item => item.name)
  await runWithTenantRlsScope(
    [agent.organizationId],
    undefined,
    () => getPostgresPool().query(
      `UPDATE sf_print_agents SET available_printers = $3::jsonb, last_seen_at = now()
       WHERE organization_id = $1 AND id = $2 AND active = true`,
      [agent.organizationId, agent.agentId, JSON.stringify(printers)],
    ),
    "privileged-backend",
  )
  return NextResponse.json({ ok: true, count: printers.length })
}
