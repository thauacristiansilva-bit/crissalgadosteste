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

  await recordCurrentLegalAcceptance({
    userId: session.userId,
    organizationId: session.organizationId,
    source: "admin-legal-gate",
    ipAddress: requestIp(request),
    userAgent: request.headers.get("user-agent") || "",
  })

  return NextResponse.json({ ok: true })
}
