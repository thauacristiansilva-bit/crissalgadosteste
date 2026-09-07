import {
  cookies,
} from "next/headers"
import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_COOKIE,
  parseAdminSessionToken,
} from "@/lib/auth"
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
} from "@/lib/security/two-factor-challenge"
import {
  PASSKEY_CHALLENGE_COOKIE,
} from "@/lib/security/passkey-challenge"
import {
  revokeAdminSession,
} from "@/lib/security/admin-sessions"

export async function POST() {
  const store =
    await cookies()

  const currentSession =
    parseAdminSessionToken(
      store.get(
        ADMIN_SESSION_COOKIE,
      )?.value,
    )

  if (
    currentSession?.mode ===
    "tenant"
  ) {
    await revokeAdminSession({
      sessionId:
        currentSession.sessionId,
      userId:
        currentSession.userId,
      reason: "logout",
    }).catch((error) => {
      console.error(
        "[SaborFlow] Falha ao revogar sessão no logout:",
        error instanceof Error
          ? error.message
          : error,
      )
    })
  }

  const response =
    NextResponse.json({
      ok: true,
    })

  for (const cookieName of [
    ADMIN_SESSION_COOKIE,
    SUPERADMIN_SESSION_COOKIE,
    LEGACY_ADMIN_SESSION_COOKIE,
    TWO_FACTOR_CHALLENGE_COOKIE,
    PASSKEY_CHALLENGE_COOKIE,
  ]) {
    response.cookies.set(
      cookieName,
      "",
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 0,
      },
    )
  }

  response.headers.set(
    "Cache-Control",
    "no-store",
  )

  return response
}
