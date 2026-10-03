import { NextResponse } from "next/server"
import { canAccessIntegrations } from "@/lib/integrations-db"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { resolvePublicAppOrigin } from "@/lib/public-origin"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { completeWhatsAppEmbeddedSignup, getEmbeddedSignupPublicConfig } from "@/lib/whatsapp-embedded-signup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso às integrações." }, { status: 403 })
  return NextResponse.json(getEmbeddedSignupPublicConfig(), { headers: { "cache-control": "no-store" } })
}

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 })
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso às integrações." }, { status: 403 })

  const body = await request.json().catch(() => null) as {
    code?: string
    wabaId?: string
    phoneNumberId?: string
    businessId?: string | null
    pin?: string
  } | null

  if (!body?.code || !body.wabaId || !body.phoneNumberId || !body.pin) {
    return NextResponse.json({ error: "A conexão da Meta está incompleta." }, { status: 400 })
  }

  try {
    const publicOrigin = resolvePublicAppOrigin(request)
    const result = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => completeWhatsAppEmbeddedSignup(session, {
        code: body.code!,
        wabaId: body.wabaId!,
        phoneNumberId: body.phoneNumberId!,
        businessId: body.businessId || null,
        pin: body.pin!,
        publicOrigin,
      }),
      "tenant-session",
    )
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível conectar o WhatsApp." }, { status: 400 })
  }
}
