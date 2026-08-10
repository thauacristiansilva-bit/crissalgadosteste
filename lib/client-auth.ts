import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { getCustomerAccount } from "@/lib/db"

export const CLIENT_SESSION_COOKIE = "cris_client_session"

function secret() {
  return process.env.CLIENT_SESSION_SECRET || process.env.SESSION_SECRET || "cris-client-dev-secret-change-me"
}

export function createClientToken(accountId: number, maxAgeDays: number) {
  const expires = Math.floor(Date.now() / 1000) + maxAgeDays * 86400
  const payload = `${accountId}.${expires}`
  const signature = createHmac("sha256", secret()).update(payload).digest("hex")
  return `${payload}.${signature}`
}

export function parseClientToken(token?: string | null) {
  if (!token) return null
  const [idText, expiresText, signature] = token.split(".")
  const accountId = Number(idText)
  const expires = Number(expiresText)
  if (!Number.isInteger(accountId) || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !signature) return null
  const payload = `${accountId}.${expires}`
  const expected = createHmac("sha256", secret()).update(payload).digest("hex")
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { accountId, expires }
}

export async function getCurrentCustomerAccount() {
  const store = await cookies()
  const parsed = parseClientToken(store.get(CLIENT_SESSION_COOKIE)?.value)
  if (!parsed) return null
  return getCustomerAccount(parsed.accountId)
}
