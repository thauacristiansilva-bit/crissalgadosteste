import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { metaAuthorizationUrl } from "@/lib/meta-instagram"

export const dynamic = "force-dynamic"

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
      { error: "Seu perfil nao pode conectar o Instagram." },
      { status: 403 },
    )
  }

  try {
    return NextResponse.redirect(
      metaAuthorizationUrl(
        session.organizationId,
        session.userId,
      ),
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Integracao Meta ainda nao configurada.",
      },
      { status: 400 },
    )
  }
}
