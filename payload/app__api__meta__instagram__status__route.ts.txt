import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getMetaInstagramConnectionPublic } from "@/lib/meta-instagram-db"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Sessao tenant obrigatoria." },
      { status: 401 },
    )
  }

  if (!canManageMarketing(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil nao pode gerenciar o Instagram.",
      },
      { status: 403 },
    )
  }

  try {
    const connection =
      await runWithTenantRlsScope(
        [session.organizationId],
        session.userId,
        () =>
          getMetaInstagramConnectionPublic(
            session.organizationId,
          ),
        "tenant-session",
      )

    return NextResponse.json({
      configured: Boolean(
        process.env.META_INSTAGRAM_APP_ID &&
        process.env.META_INSTAGRAM_APP_SECRET &&
        process.env.META_TOKEN_ENCRYPTION_KEY &&
        (
          process.env.APP_PUBLIC_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.PUBLIC_APP_URL
        )
      ),
      authMode: "instagram_login",
      requiredVariables: [
        "META_INSTAGRAM_APP_ID",
        "META_INSTAGRAM_APP_SECRET",
        "META_TOKEN_ENCRYPTION_KEY",
        "APP_PUBLIC_URL",
      ],
      connection,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel verificar o Instagram.",
      },
      { status: 400 },
    )
  }
}
