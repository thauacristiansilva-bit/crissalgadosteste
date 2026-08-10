import { NextResponse } from "next/server"
import { authenticateCustomer, getSettings, safeCustomer } from "@/lib/db"
import { CLIENT_SESSION_COOKIE, createClientToken } from "@/lib/client-auth"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { cpf?: string; pin?: string; remember?: boolean } | null
  if (!body) return NextResponse.json({ error: "Informe CPF e PIN." }, { status: 400 })
  const account = await authenticateCustomer(body.cpf || "", body.pin || "")
  if (!account) return NextResponse.json({ error: "CPF ou PIN inválido." }, { status: 401 })
  const settings = await getSettings()
  const days = body.remember === false ? 1 : settings.rememberClientDays
  const response = NextResponse.json({ customer: safeCustomer(account) })
  response.cookies.set(CLIENT_SESSION_COOKIE, createClientToken(account.id, days), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: days * 86400 })
  return response
}
