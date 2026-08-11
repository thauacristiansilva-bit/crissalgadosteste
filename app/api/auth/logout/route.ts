import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
} from "@/lib/auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })

  for (const cookieName of [
    ADMIN_SESSION_COOKIE,
    LEGACY_ADMIN_SESSION_COOKIE,
  ]) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })
  }

  return response
}
