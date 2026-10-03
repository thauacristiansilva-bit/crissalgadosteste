import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { disconnectMetaInstagram } from "@/lib/meta-instagram-db"

export const dynamic = "force-dynamic"

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

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Sessao tenant obrigatoria." }, { status: 401 })
  }

  if (!canManageMarketing(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode desconectar o Instagram." },
      { status: 403 },
    )
  }

  await runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    () => disconnectMetaInstagram(session.organizationId),
    "tenant-session",
  )

  return NextResponse.json({ ok: true })
}
