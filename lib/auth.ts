import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const ADMIN_SESSION_COOKIE = "cris_admin_session"

export const getAdminEmail = () => process.env.ADMIN_EMAIL || "admin@crissalgados.com"
const getAdminPassword = () => process.env.ADMIN_PASSWORD || "cris1234"
const getSessionSecret = () =>
  process.env.SESSION_SECRET || `${getAdminPassword()}::cris-salgados-dev-secret`

export function credentialsAreValid(email: string, password: string) {
  return email.trim().toLowerCase() === getAdminEmail().toLowerCase() && password === getAdminPassword()
}

export function createSessionToken() {
  return createHmac("sha256", getSessionSecret())
    .update(`cris-admin:${getAdminEmail().toLowerCase()}`)
    .digest("hex")
}

export function sessionTokenIsValid(token?: string | null) {
  if (!token) return false
  const expected = createSessionToken()
  const actualBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies()
  return sessionTokenIsValid(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}
