import { NextResponse } from "next/server"
import { canAccessIntegrations } from "@/lib/integrations-db"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { deleteWhatsAppTemplate, upsertWhatsAppTemplate } from "@/lib/whatsapp-inbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso às integrações." }, { status: 403 })

  const body = await request.json().catch(() => null) as {
    action?: "save" | "delete"
    id?: string
    connectionId?: string
    name?: string
    label?: string
    languageCode?: string
    category?: string
    status?: string
    templateBody?: string
    useCase?: string
    metaTemplateId?: string
    rejectionReason?: string
  } | null

  try {
    const result = await runWithTenantRlsScope([session.organizationId], session.userId, async () => {
      if (body?.action === "delete") {
        if (!body.id) throw new Error("Modelo não informado.")
        return deleteWhatsAppTemplate(session, body.id)
      }
      if (!body?.connectionId) throw new Error("Conexão do WhatsApp não informada.")
      return upsertWhatsAppTemplate(session, {
        id: body.id,
        connectionId: body.connectionId,
        name: body.name || "",
        label: body.label || "",
        languageCode: body.languageCode,
        category: body.category,
        status: body.status,
        body: body.templateBody || "",
        useCase: body.useCase,
        metaTemplateId: body.metaTemplateId,
        rejectionReason: body.rejectionReason,
      })
    }, "tenant-session")
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar o modelo." }, { status: 400 })
  }
}
