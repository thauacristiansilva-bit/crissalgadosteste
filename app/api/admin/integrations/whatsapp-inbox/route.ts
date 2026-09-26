import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canAccessIntegrations } from "@/lib/integrations-db"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { listWhatsAppInbox, queueWhatsAppReply, suggestWhatsAppReply } from "@/lib/whatsapp-inbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso às integrações." }, { status: 403 })
  try {
    return NextResponse.json(await runWithTenantRlsScope([session.organizationId], session.userId, () => listWhatsAppInbox(session.organizationId), "tenant-session"))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao carregar conversas." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso às integrações." }, { status: 403 })
  const body = await request.json().catch(() => null) as { action?: string; connectionId?: string; recipient?: string; message?: string } | null
  if (!body?.connectionId || !body.recipient || !["reply", "suggest"].includes(body.action || "")) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  try {
    const result = await runWithTenantRlsScope([session.organizationId], session.userId, async () => {
      const inbox = await listWhatsAppInbox(session.organizationId)
      const contact = inbox.contacts.find(item => item.connectionId === body.connectionId && item.phone === body.recipient)
      if (!contact) throw new Error("Conversa não encontrada.")
      if (body.action === "reply") return queueWhatsAppReply(session, body.connectionId!, body.recipient!, body.message || "")
      const latest = inbox.incoming.filter(item => item.connectionId === body.connectionId && item.from === body.recipient).sort((a, b) => b.at.localeCompare(a.at))[0]
      if (!latest) throw new Error("Não há mensagem recebida para responder.")
      return { suggestion: await suggestWhatsAppReply(session.organizationId, latest.text) }
    }, "tenant-session")
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível responder." }, { status: 400 })
  }
}
