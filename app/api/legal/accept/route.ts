import { NextResponse } from "next/server"
import { recordCurrentLegalAcceptance } from "@/lib/legal-db"
import { requestIp, requestIsSameOrigin } from "@/lib/security/request-security"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 })
  }

  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 })

  const body = await request.json().catch(() => null) as { accepted?: boolean } | null
  if (body?.accepted !== true) {
    return NextResponse.json({ error: "Confirme a leitura dos documentos para continuar." }, { status: 400 })
  }

  try {
    await recordCurrentLegalAcceptance({
      userId: session.userId,
      organizationId: session.organizationId,
      source: "admin-legal-gate",
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent") || "",
    })
  } catch (error) {
    console.error("[SaborFlow] Falha ao registrar aceite legal:", error)
    return NextResponse.json(
      { error: "Não foi possível registrar o aceite. Tente novamente." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
