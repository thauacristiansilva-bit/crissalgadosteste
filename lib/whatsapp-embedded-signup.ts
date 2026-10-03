import { createHmac, randomBytes } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import type { TenantAdminSession } from "@/lib/tenant-access"
import { setIntegrationConnectionStatus, upsertIntegrationConnection } from "@/lib/integrations-db"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function graphVersion() {
  const version = clean(process.env.META_GRAPH_API_VERSION, 20)
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("Configure META_GRAPH_API_VERSION no formato vNN.N.")
  }
  return version
}

function requiredEnv(name: string) {
  const value = clean(process.env[name], 4000)
  if (!value) throw new Error(`Configure ${name} no Railway.`)
  return value
}

function graphError(status: number, raw: string) {
  let message = raw.replace(/\s+/g, " ").trim().slice(0, 500)
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    if (parsed.error?.message) message = parsed.error.message
  } catch {
    // Mantém a resposta compactada.
  }
  return new Error(`A Meta recusou a configuração (${status})${message ? `: ${message}` : "."}`)
}

async function graphRequest<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  const raw = await response.text()
  if (!response.ok) throw graphError(response.status, raw)
  return (raw ? JSON.parse(raw) : {}) as T
}

function appSecretProof(accessToken: string, appSecret: string) {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex")
}

export function getEmbeddedSignupPublicConfig() {
  const appId = clean(process.env.META_APP_ID, 100)
  const configId = clean(process.env.META_WHATSAPP_CONFIG_ID, 200)
  const apiVersion = clean(process.env.META_GRAPH_API_VERSION, 20)
  const solutionId = clean(process.env.META_WHATSAPP_SOLUTION_ID, 200)
  const appSecretConfigured = Boolean(clean(process.env.META_APP_SECRET, 4000))
  const ready = Boolean(appId && configId && /^v\d+\.\d+$/.test(apiVersion) && appSecretConfigured)

  return {
    ready,
    appId,
    configId,
    apiVersion,
    solutionId: solutionId || null,
    appSecretConfigured,
    version: "v4",
  }
}

export async function completeWhatsAppEmbeddedSignup(
  session: TenantAdminSession,
  input: {
    code: string
    wabaId: string
    phoneNumberId: string
    businessId?: string | null
    pin: string
    publicOrigin: string
  },
) {
  const appId = requiredEnv("META_APP_ID")
  const appSecret = requiredEnv("META_APP_SECRET")
  const version = graphVersion()
  const code = clean(input.code, 4000)
  const wabaId = clean(input.wabaId, 120)
  const phoneNumberId = clean(input.phoneNumberId, 120)
  const businessId = clean(input.businessId, 120)
  const pin = clean(input.pin, 12).replace(/\D/g, "")

  if (!code || !wabaId || !phoneNumberId) throw new Error("A Meta não retornou todos os dados da conexão.")
  if (!/^\d{6}$/.test(pin)) throw new Error("Crie um PIN de segurança com exatamente 6 dígitos.")

  const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  tokenUrl.searchParams.set("client_id", appId)
  tokenUrl.searchParams.set("client_secret", appSecret)
  tokenUrl.searchParams.set("code", code)

  const tokenResult = await graphRequest<{ access_token?: string; token_type?: string }>(tokenUrl.toString())
  const accessToken = clean(tokenResult.access_token, 4000)
  if (!accessToken) throw new Error("A Meta não retornou o token da empresa.")

  const proof = appSecretProof(accessToken, appSecret)
  const phonesUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(wabaId)}/phone_numbers`)
  phonesUrl.searchParams.set("fields", "id,display_phone_number,verified_name,quality_rating")
  phonesUrl.searchParams.set("appsecret_proof", proof)
  const phoneResult = await graphRequest<{
    data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string; quality_rating?: string }>
  }>(phonesUrl.toString(), { headers: { authorization: `Bearer ${accessToken}` } })

  const phone = phoneResult.data?.find((item) => String(item.id || "") === phoneNumberId)
  if (!phone) throw new Error("O número retornado não pertence à conta do WhatsApp autorizada.")

  await graphRequest<{ success?: boolean }>(
    `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/register`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    },
  )

  const existing = await getPostgresPool().query<{ id: string }>(
    `
      SELECT id
      FROM sf_integration_connections
      WHERE organization_id = $1
        AND provider = 'whatsapp_meta'
        AND settings->>'phoneNumberId' = $2
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [session.organizationId, phoneNumberId],
  )

  const verifyToken = randomBytes(32).toString("hex")
  const displayPhoneNumber = clean(phone.display_phone_number, 80)
  const verifiedName = clean(phone.verified_name, 160)
  const connectionName = verifiedName
    ? `WhatsApp · ${verifiedName}`
    : displayPhoneNumber
      ? `WhatsApp · ${displayPhoneNumber}`
      : "WhatsApp conectado pela Meta"

  const connectionId = await upsertIntegrationConnection(session, {
    connectionId: existing.rows[0]?.id || null,
    name: connectionName,
    provider: "whatsapp_meta",
    enabled: false,
    settings: {
      apiVersion: version,
      defaultCountryCode: "55",
      templateName: "",
      languageCode: "pt_BR",
      orderNotificationsEnabled: false,
      phoneNumberId,
      wabaId,
      businessId,
      displayPhoneNumber,
      verifiedName,
      qualityRating: clean(phone.quality_rating, 40),
      onboardingMethod: "embedded_signup_v4",
    },
    credentials: { accessToken, phoneNumberId, appSecret, verifyToken },
  })

  if (!connectionId) throw new Error("Não foi possível criar a conexão do WhatsApp.")

  const callbackUrl = `${input.publicOrigin.replace(/\/$/, "")}/api/integrations/whatsapp/${connectionId}`
  await graphRequest<{ success?: boolean; data?: unknown }>(
    `https://graph.facebook.com/${version}/${encodeURIComponent(wabaId)}/subscribed_apps`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ override_callback_uri: callbackUrl, verify_token: verifyToken }),
    },
  )

  await setIntegrationConnectionStatus(session, { connectionId, enabled: true })

  return {
    connectionId,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: displayPhoneNumber || null,
    verifiedName: verifiedName || null,
    callbackUrl,
    status: "active" as const,
  }
}
