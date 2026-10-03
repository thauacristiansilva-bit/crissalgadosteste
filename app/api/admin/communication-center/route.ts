import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { permissionListHas } from "@/lib/operational-permissions"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import {
  addTicketMessage,
  createCommunicationCampaign,
  createSupportTicket,
  getCommunicationCenterSnapshot,
  getTicketMessages,
  markNotificationRead,
  saveNotificationPreferences,
  updateSupportTicket,
} from "@/lib/communication-center"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function canView(session: NonNullable<Awaited<ReturnType<typeof getVerifiedTenantSession>>>) {
  return permissionListHas(session.operationalPermissions, "customers.view")
    || permissionListHas(session.operationalPermissions, "marketing.view")
    || permissionListHas(session.operationalPermissions, "dashboard.view")
}

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canView(session)) return NextResponse.json({ error: "Sem acesso à Central de Comunicação." }, { status: 403 })

  try {
    const url = new URL(request.url)
    const ticketId = url.searchParams.get("ticketId")
    if (ticketId) {
      return NextResponse.json({ messages: await getTicketMessages(session, ticketId) })
    }
    return NextResponse.json(await getCommunicationCenterSnapshot(session))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar a Central de Comunicação." },
      { status: 503 },
    )
  }
}

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  }
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canView(session)) return NextResponse.json({ error: "Sem acesso à Central de Comunicação." }, { status: 403 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  const action = String(body.action || "")

  try {
    let result: unknown
    if (action === "create_ticket") {
      if (!permissionListHas(session.operationalPermissions, "customers.manage")) throw new Error("Seu perfil não pode criar chamados.")
      result = await createSupportTicket(session, body)
    } else if (action === "ticket_message") {
      if (!permissionListHas(session.operationalPermissions, "customers.manage")) throw new Error("Seu perfil não pode responder chamados.")
      result = await addTicketMessage(session, body)
    } else if (action === "update_ticket") {
      if (!permissionListHas(session.operationalPermissions, "customers.manage")) throw new Error("Seu perfil não pode alterar chamados.")
      result = await updateSupportTicket(session, body)
    } else if (action === "mark_notification") {
      result = await markNotificationRead(session, String(body.notificationId || ""))
    } else if (action === "save_preferences") {
      result = await saveNotificationPreferences(session, body)
    } else if (action === "create_campaign") {
      if (!permissionListHas(session.operationalPermissions, "marketing.manage")) throw new Error("Seu perfil não pode criar campanhas.")
      result = await createCommunicationCampaign(session, body)
    } else {
      throw new Error("Ação inválida.")
    }
    return NextResponse.json({ ok: true, ...(typeof result === "object" && result ? result : {}) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir." },
      { status: 400 },
    )
  }
}
