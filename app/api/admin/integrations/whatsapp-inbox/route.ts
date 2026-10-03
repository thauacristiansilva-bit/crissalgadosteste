import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canAccessIntegrations } from "@/lib/integrations-db"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  listWhatsAppInbox,
  queueWhatsAppReply,
  queueWhatsAppTemplate,
  suggestWhatsAppReply,
  updateWhatsAppConversation,
} from "@/lib/whatsapp-inbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const conversationActions = new Set(["takeover", "resume_ai", "close", "reopen", "waiting", "mark_read", "labels"])

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

  const body = await request.json().catch(() => null) as {
    action?: string
    connectionId?: string
    recipient?: string
    message?: string
    labels?: string[]
  } | null
  if (!body?.connectionId || !body.recipient || !body.action) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })

  const connectionId = body.connectionId
  const recipient = body.recipient
  const action = body.action
  const message = body.message || ""
  const labels = body.labels

  try {
    const result = await runWithTenantRlsScope([session.organizationId], session.userId, async () => {
      const inbox = await listWhatsAppInbox(session.organizationId)
      const contact = inbox.contacts.find(item => item.connectionId === connectionId && item.phone === recipient)
      if (!contact) throw new Error("Conversa não encontrada.")

      if (action === "reply") return queueWhatsAppReply(session, connectionId, recipient, message)
      if (action === "template") return queueWhatsAppTemplate(session, connectionId, recipient, message)
      if (action === "suggest") {
        const latest = inbox.incoming.filter(item => item.connectionId === connectionId && item.from === recipient).sort((a, b) => b.at.localeCompare(a.at))[0]
        if (!latest) throw new Error("Não há mensagem recebida para responder.")
        return { suggestion: await suggestWhatsAppReply(session.organizationId, latest.text) }
      }
      if (conversationActions.has(action)) {
        return updateWhatsAppConversation(session, connectionId, recipient, action, labels)
      }
      throw new Error("Ação inválida.")
    }, "tenant-session")
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível concluir." }, { status: 400 })
  }
}
