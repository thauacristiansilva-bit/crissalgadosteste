import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  credentialsAreValid,
} from "@/lib/auth"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null

  if (!body?.email || !body?.password || !credentialsAreValid(body.email, body.password)) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}
