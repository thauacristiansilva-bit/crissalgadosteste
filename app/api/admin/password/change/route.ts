import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
} from "@/lib/auth"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  changeAdminUserPassword,
} from "@/lib/admin-user-db"

export async function POST(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        currentPassword?: string
        newPassword?: string
      }
    | null

  try {
    await changeAdminUserPassword(
      session.userId,
      body?.currentPassword || "",
      body?.newPassword || "",
    )

    const response =
      NextResponse.json({
        ok: true,
        relogin: true,
      })

    response.cookies.delete(
      ADMIN_SESSION_COOKIE,
    )
    response.cookies.delete(
      LEGACY_ADMIN_SESSION_COOKIE,
    )

    return response
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível alterar a senha.",
      },
      { status: 400 },
    )
  }
}
