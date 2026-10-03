import { NextResponse } from "next/server"
import {
  exchangeInstagramCode,
  metaPublicBaseUrl,
  resolveInstagramAccount,
  verifyMetaOauthState,
} from "@/lib/meta-instagram"
import { saveMetaInstagramConnection } from "@/lib/meta-instagram-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

function redirectResult(
  status: string,
  message?: string,
) {
  let base: string

  try {
    base = metaPublicBaseUrl()
  } catch {
    base = "http://localhost:3000"
  }

  const url = new URL("/gerente", base)
  url.searchParams.set("instagram", status)

  if (message) {
    url.searchParams.set(
      "instagram_message",
      message.slice(0, 180),
    )
  }

  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = String(
    url.searchParams.get("code") || "",
  )
  const state = String(
    url.searchParams.get("state") || "",
  )
  const oauthError = String(
    url.searchParams.get("error_description") ||
    url.searchParams.get("error_message") ||
    url.searchParams.get("error") ||
    "",
  )

  if (oauthError) {
    return redirectResult(
      "error",
      oauthError,
    )
  }

  if (!code || !state) {
    return redirectResult(
      "error",
      "Autorizacao incompleta.",
    )
  }

  try {
    const payload =
      verifyMetaOauthState(state)

    const token =
      await exchangeInstagramCode(code)

    const account =
      await resolveInstagramAccount(
        token.accessToken,
        token.userId,
      )

    const tokenExpiresAt =
      token.expiresIn > 0
        ? new Date(
            Date.now() +
            token.expiresIn * 1000,
          ).toISOString()
        : null

    await runWithTenantRlsScope(
      [payload.organizationId],
      payload.userId,
      () =>
        saveMetaInstagramConnection(
          payload.organizationId,
          account,
          tokenExpiresAt,
        ),
      "tenant-session",
    )

    return redirectResult(
      "connected",
      token.longLived
        ? undefined
        : "Conta conectada com token temporario. Reconecte se a sessao expirar.",
    )
  } catch (error) {
    console.error(
      "[instagram-login:callback]",
      error,
    )

    return redirectResult(
      "error",
      error instanceof Error
        ? error.message
        : "Nao foi possivel conectar o Instagram.",
    )
  }
}
