import { createPublicKey, verify } from "node:crypto"

export type VerifiedGoogleIdentity = {
  subject: string
  email: string
  name: string
  picture: string | null
}

type GoogleJwk = Record<string, unknown> & { kid?: string; alg?: string; use?: string }
type GoogleJwks = { keys?: GoogleJwk[] }

type GoogleIdPayload = {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  aud?: string | string[]
  iss?: string
  exp?: number
  nbf?: number
}

let cachedKeys: GoogleJwk[] = []
let cachedKeysUntil = 0

function googleClientId() {
  return (
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    ""
  )
}

export function googleSignInConfigured() {
  return Boolean(googleClientId())
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T
}

async function googleSigningKeys() {
  const now = Date.now()
  if (cachedKeys.length > 0 && cachedKeysUntil > now) return cachedKeys

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error("Não foi possível consultar as chaves de autenticação do Google.")

  const payload = await response.json() as GoogleJwks
  const keys = Array.isArray(payload.keys) ? payload.keys : []
  if (keys.length === 0) throw new Error("O Google não retornou chaves de autenticação válidas.")

  const cacheControl = response.headers.get("cache-control") || ""
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i)
  const maxAgeSeconds = Math.min(Math.max(Number(maxAgeMatch?.[1] || 300), 60), 3600)
  cachedKeys = keys
  cachedKeysUntil = now + maxAgeSeconds * 1000
  return keys
}

function audienceMatches(aud: string | string[] | undefined, expected: string) {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected
}

export async function verifyGoogleCredential(
  credential: string,
): Promise<VerifiedGoogleIdentity> {
  const audience = googleClientId()
  if (!audience) throw new Error("Login com Google ainda não foi configurado.")
  if (!credential || credential.length > 10000) throw new Error("Credencial Google inválida.")

  const parts = credential.split(".")
  if (parts.length !== 3) throw new Error("Credencial Google inválida.")
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Credencial Google inválida.")

  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(encodedHeader)
  const payload = decodeBase64UrlJson<GoogleIdPayload>(encodedPayload)

  if (header.alg !== "RS256" || !header.kid) throw new Error("Assinatura Google inválida.")
  const keys = await googleSigningKeys()
  const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === "RS256"))
  if (!jwk) {
    cachedKeysUntil = 0
    cachedKeys = []
    const refreshed = await googleSigningKeys()
    const refreshedJwk = refreshed.find((key) => key.kid === header.kid && (!key.alg || key.alg === "RS256"))
    if (!refreshedJwk) throw new Error("Chave de autenticação Google não reconhecida.")
    const key = createPublicKey({ key: refreshedJwk as any, format: "jwk" })
    const valid = verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      key,
      Buffer.from(encodedSignature, "base64url"),
    )
    if (!valid) throw new Error("Assinatura Google inválida.")
  } else {
    const key = createPublicKey({ key: jwk as any, format: "jwk" })
    const valid = verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      key,
      Buffer.from(encodedSignature, "base64url"),
    )
    if (!valid) throw new Error("Assinatura Google inválida.")
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    throw new Error("Emissor da Conta Google inválido.")
  }
  if (!audienceMatches(payload.aud, audience)) throw new Error("Conta Google destinada a outro aplicativo.")
  if (!payload.exp || payload.exp <= now) throw new Error("A autenticação Google expirou. Tente novamente.")
  if (payload.nbf && payload.nbf > now + 60) throw new Error("Credencial Google ainda não é válida.")
  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("Não foi possível confirmar o e-mail da Conta Google.")
  }

  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: String(payload.name || payload.email.split("@")[0] || "Usuário Google").trim(),
    picture: payload.picture || null,
  }
}
