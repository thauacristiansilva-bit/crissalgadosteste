import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  updateTenantMarketingPublication,
  type MarketingPublicationInput,
} from "@/lib/marketing-publications-db"

export const dynamic = "force-dynamic"

function patchFromBody(body: Record<string, unknown>): Partial<MarketingPublicationInput> {
  const patch: Partial<MarketingPublicationInput> = {}

  if (body.title !== undefined) patch.title = String(body.title || "")
  if (body.channel !== undefined) patch.channel = String(body.channel) as MarketingPublicationInput["channel"]
  if (body.contentType !== undefined) patch.contentType = String(body.contentType) as MarketingPublicationInput["contentType"]
  if (body.caption !== undefined) patch.caption = String(body.caption || "")
  if (body.cta !== undefined) patch.cta = String(body.cta || "")
  if (body.mediaUrl !== undefined) patch.mediaUrl = String(body.mediaUrl || "")
  if (body.templateKey !== undefined) patch.templateKey = String(body.templateKey || "")
  if (body.flyerPayload !== undefined) {
    patch.flyerPayload = body.flyerPayload && typeof body.flyerPayload === "object" && !Array.isArray(body.flyerPayload)
      ? body.flyerPayload as Record<string, unknown>
      : {}
  }
  if (body.scheduledAt !== undefined) patch.scheduledAt = String(body.scheduledAt || "")
  if (body.recurrence !== undefined) patch.recurrence = String(body.recurrence) as MarketingPublicationInput["recurrence"]
  if (body.recurrenceDays !== undefined) patch.recurrenceDays = Array.isArray(body.recurrenceDays) ? body.recurrenceDays.map(Number) : []
  if (body.recurrenceTime !== undefined) patch.recurrenceTime = String(body.recurrenceTime || "")
  if (body.status !== undefined) patch.status = String(body.status) as MarketingPublicationInput["status"]
  if (body.active !== undefined) patch.active = Boolean(body.active)
  if (body.publishedAt !== undefined) patch.publishedAt = String(body.publishedAt || "")
  if (body.lastError !== undefined) patch.lastError = String(body.lastError || "")

  return patch
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisicao nao permitida." },
      { status: 403 },
    )
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  try {
    const session = await getVerifiedTenantSession()
    if (!session) {
      return NextResponse.json({ error: "Sessao tenant obrigatoria." }, { status: 401 })
    }
    if (!canManageMarketing(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil nao pode gerenciar publicacoes." },
        { status: 403 },
      )
    }

    const { id } = await context.params
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Publicacao invalida." }, { status: 400 })
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) throw new Error("Dados da publicacao obrigatorios.")

    const publication = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => updateTenantMarketingPublication(
        session.organizationId,
        id,
        patchFromBody(body),
      ),
      "tenant-session",
    )

    if (!publication) {
      return NextResponse.json({ error: "Publicacao nao encontrada." }, { status: 404 })
    }
    return NextResponse.json({ publication })
  } catch (error) {
    console.error("[marketing-publications:PATCH]", error)
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar a publicacao.",
      },
      { status: 400 },
    )
  }
}
