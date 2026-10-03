import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  createTenantMarketingPublication,
  getTenantMarketingPublications,
  isMarketingPublicationsReady,
  type MarketingPublicationInput,
} from "@/lib/marketing-publications-db"

export const dynamic = "force-dynamic"

function inputFromBody(body: Record<string, unknown>): MarketingPublicationInput {
  return {
    title: String(body.title || ""),
    channel: String(body.channel || "instagram_story") as MarketingPublicationInput["channel"],
    contentType: String(body.contentType || "flyer") as MarketingPublicationInput["contentType"],
    caption: body.caption === undefined ? undefined : String(body.caption || ""),
    cta: body.cta === undefined ? undefined : String(body.cta || ""),
    mediaUrl: body.mediaUrl === undefined ? undefined : String(body.mediaUrl || ""),
    templateKey: body.templateKey === undefined ? undefined : String(body.templateKey || ""),
    flyerPayload:
      body.flyerPayload && typeof body.flyerPayload === "object" && !Array.isArray(body.flyerPayload)
        ? body.flyerPayload as Record<string, unknown>
        : {},
    scheduledAt: body.scheduledAt === undefined ? undefined : String(body.scheduledAt || ""),
    recurrence: String(body.recurrence || "none") as MarketingPublicationInput["recurrence"],
    recurrenceDays: Array.isArray(body.recurrenceDays) ? body.recurrenceDays.map(Number) : [],
    recurrenceTime: body.recurrenceTime === undefined ? undefined : String(body.recurrenceTime || ""),
    status: String(body.status || "draft") as MarketingPublicationInput["status"],
    active: body.active !== false,
    publishedAt: body.publishedAt === undefined ? undefined : String(body.publishedAt || ""),
    lastError: body.lastError === undefined ? undefined : String(body.lastError || ""),
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Sessao tenant obrigatoria." }, { status: 401 })
  }
  if (!canManageMarketing(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode visualizar publicacoes." },
      { status: 403 },
    )
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        const [ready, publications] = await Promise.all([
          isMarketingPublicationsReady().catch(() => false),
          getTenantMarketingPublications(session.organizationId),
        ])
        return NextResponse.json({ ready, publications })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Nao foi possivel carregar as publicacoes.",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) throw new Error("Dados da publicacao obrigatorios.")

    const publication = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => createTenantMarketingPublication(
        session.organizationId,
        session.userId,
        inputFromBody(body),
      ),
      "tenant-session",
    )

    if (!publication) throw new Error("Nao foi possivel carregar a publicacao criada.")
    return NextResponse.json({ publication }, { status: 201 })
  } catch (error) {
    console.error("[marketing-publications:POST]", error)
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Nao foi possivel criar a publicacao.",
      },
      { status: 400 },
    )
  }
}
