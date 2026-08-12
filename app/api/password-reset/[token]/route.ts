import { NextResponse } from "next/server"
import {
  getPasswordResetPreview,
  resetAdminUserPassword,
} from "@/lib/admin-user-db"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      token: string
    }>
  },
) {
  const { token } =
    await context.params

  const preview =
    await getPasswordResetPreview(
      decodeURIComponent(token),
    )

  if (!preview) {
    return NextResponse.json(
      {
        error:
          "Link inválido ou expirado.",
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    reset: {
      name: preview.name,
      email: preview.email,
      expiresAt:
        preview.expiresAt,
    },
  })
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      token: string
    }>
  },
) {
  const { token } =
    await context.params

  const body = (await request
    .json()
    .catch(() => null)) as
    | { password?: string }
    | null

  try {
    const result =
      await resetAdminUserPassword(
        decodeURIComponent(token),
        body?.password || "",
      )

    return NextResponse.json({
      ok: true,
      result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível redefinir a senha.",
      },
      { status: 400 },
    )
  }
}
