import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const BILLING_SESSION_COOKIE = "saborflow_billing_session"

export type CommercialBillingSession = {
  userId: string
  billingAccountId: string
  email: string
  expiresAt: number
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim()
  if (!secret) throw new Error("SESSION_SECRET é obrigatório para a contratação comercial.")
  return secret
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret())
    .update(`billing-session:v1:${value}`)
    .digest("base64url")
}

function safeEqual(actual: string, expected: string) {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createCommercialBillingSessionToken(input: {
  userId: string
  billingAccountId: string
  email: string
}) {
  const payload: CommercialBillingSession = {
    ...input,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `b1.${encoded}.${sign(encoded)}`
}

export function parseCommercialBillingSessionToken(token?: string | null): CommercialBillingSession | null {
  if (!token?.startsWith("b1.")) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [, encoded, signature] = parts
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CommercialBillingSession>
    if (!payload.userId || !payload.billingAccountId || !payload.email || !payload.expiresAt || payload.expiresAt <= Date.now()) return null
    return {
      userId: payload.userId,
      billingAccountId: payload.billingAccountId,
      email: payload.email,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export async function getCommercialBillingSession() {
  const store = await cookies()
  return parseCommercialBillingSessionToken(store.get(BILLING_SESSION_COOKIE)?.value)
}

export const commercialBillingCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
}

export const clearCommercialBillingCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
}
