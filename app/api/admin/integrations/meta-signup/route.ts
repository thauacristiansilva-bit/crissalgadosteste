import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canAccessIntegrations, getIntegrationsOverview } from "@/lib/integrations-db"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { decryptIntegrationCredentials, encryptIntegrationCredentials, integrationEncryptionConfigured } from "@/lib/integration-crypto"
import { getPostgresPool } from "@/lib/postgres"
import { assertDemoActionAllowed } from "@/lib/demo-policy"
import { runWithRlsBypass, runWithTenantRlsScope } from "@/lib/rls-context"

export const runtime = "nodejs"

function config() {
  const appId = process.env.META_APP_ID?.trim() || ""
  const appSecret = process.env.META_APP_SECRET?.trim() || ""
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || ""
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || ""
  const base = process.env.APP_BASE_URL?.trim().replace(/\/$/, "") || ""
  if (!/^\d+$/.test(appId) || appSecret.length < 16 || !/^\d+$/.test(configId) || !/^v\d+\.\d+$/.test(apiVersion) || !/^https:\/\//.test(base)) return null
  return { appId, appSecret, configId, apiVersion, base }
}

async function graph<T>(path: string, token: string, options?: { method?: "POST"; body?: Record<string, unknown> }, version?: string): Promise<T> {
  const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    method: options?.method || "GET",
    headers: { authorization: `Bearer ${token}`, ...(options?.body ? { "content-type": "application/json" } : {}) },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(`Meta: ${String(data.error?.message || `HTTP ${response.status}`).slice(0, 240)}`)
  return data
}

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session || !canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso." }, { status: session ? 403 : 401 })
  const env = config()
  return NextResponse.json({ available: Boolean(env && integrationEncryptionConfigured()), appId: env?.appId || null, configId: env?.configId || null, apiVersion: env?.apiVersion || null })
}

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 })
  const session = await getVerifiedTenantSession()
  if (!session || !canAccessIntegrations(session)) return NextResponse.json({ error: "Sem acesso." }, { status: session ? 403 : 401 })
  const env = config()
  if (!env || !integrationEncryptionConfigured()) return NextResponse.json({ error: "Conexão Meta ainda não preparada na plataforma." }, { status: 503 })
  const data = await request.json().catch(() => null) as { code?: string; wabaId?: string; phoneNumberId?: string } | null
  if (!data || !/^[\w-]{10,1500}$/.test(data.code || "") || !/^\d{5,30}$/.test(data.wabaId || "") || !/^\d{5,30}$/.test(data.phoneNumberId || "")) return NextResponse.json({ error: "Dados da Meta incompletos." }, { status: 400 })
  try {
    await runWithTenantRlsScope([session.organizationId], session.userId, () => getIntegrationsOverview(session), "tenant-session")
    await assertDemoActionAllowed(session.organizationId, "dangerous-integration")
    const params = new URLSearchParams({ client_id: env.appId, client_secret: env.appSecret, code: data.code! })
    const response = await fetch(`https://graph.facebook.com/${env.apiVersion}/oauth/access_token?${params}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
    const exchange = await response.json().catch(() => ({})) as { access_token?: string; error?: { message?: string } }
    if (!response.ok || !exchange.access_token) throw new Error("A Meta não autorizou a conexão. Abra a janela e tente novamente.")
    const accessToken = exchange.access_token
    const appToken = `${env.appId}|${env.appSecret}`
    const debug = await graph<{ data?: { app_id?: string; is_valid?: boolean; scopes?: string[] } }>(`debug_token?${new URLSearchParams({ input_token: accessToken })}`, appToken, undefined, env.apiVersion)
    if (!debug.data?.is_valid || debug.data.app_id !== env.appId) throw new Error("A autorização não pertence à aplicação SaborFlow.")
    const owned = await graph<{ data?: Array<{ id: string; display_phone_number?: string; status?: string }> }>(`${data.wabaId}/phone_numbers?fields=id,display_phone_number,status`, accessToken, undefined, env.apiVersion)
    const selected = owned.data?.find(item => item.id === data.phoneNumberId)
    if (!selected) throw new Error("O número escolhido não pertence à conta autorizada na Meta.")
    const existing = await runWithRlsBypass(() => getPostgresPool().query<{ encrypted_credentials: string }>(
      `SELECT encrypted_credentials FROM sf_integration_connections WHERE provider = 'whatsapp_meta'`,
    ))
    if (existing.rows.some(row => decryptIntegrationCredentials(row.encrypted_credentials).phoneNumberId === data.phoneNumberId)) throw new Error("Este número já está cadastrado. Desative a conexão existente antes de conectar novamente.")
    if (selected.status !== "CONNECTED") throw new Error("A Meta ainda não marcou esse número como conectado. Termine a verificação/registro na Meta e tente novamente.")
    const verifyToken = randomBytes(32).toString("hex")
    const credentials = encryptIntegrationCredentials({ accessToken, phoneNumberId: data.phoneNumberId, appSecret: env.appSecret, verifyToken })
    const id = await runWithTenantRlsScope([session.organizationId], session.userId, async () => {
      const inserted = await getPostgresPool().query<{ id: string }>(
        `INSERT INTO sf_integration_connections (organization_id, name, channel, provider, status, settings, encrypted_credentials, created_by_user_id)
         VALUES ($1, $2, 'whatsapp', 'whatsapp_meta', 'disabled', $3::jsonb, $4, $5) RETURNING id`,
        [session.organizationId, `Meta ${selected.display_phone_number || data.phoneNumberId}`, JSON.stringify({ apiVersion: env.apiVersion, defaultCountryCode: "55", languageCode: "pt_BR", templateName: "", orderNotificationsEnabled: false, metaPhoneId: data.phoneNumberId, wabaId: data.wabaId, displayPhoneNumber: selected.display_phone_number || "" }), credentials, session.userId],
      )
      return inserted.rows[0].id
    }, "tenant-session")
    try {
      const subscription = await graph<{ success?: boolean }>(`${data.wabaId}/subscribed_apps`, accessToken, { method: "POST", body: { override_callback_uri: `${env.base}/api/integrations/whatsapp/${id}`, verify_token: verifyToken } }, env.apiVersion)
      if (subscription.success !== true) throw new Error("A Meta não confirmou o webhook para este número.")
      await runWithTenantRlsScope([session.organizationId], session.userId, () => getPostgresPool().query(
        `UPDATE sf_integration_connections SET status = 'active', updated_at = now() WHERE id = $1 AND organization_id = $2`, [id, session.organizationId],
      ), "tenant-session")
    } catch (error) {
      await runWithTenantRlsScope([session.organizationId], session.userId, () => getPostgresPool().query(
        `DELETE FROM sf_integration_connections WHERE id = $1 AND organization_id = $2 AND status = 'disabled'`, [id, session.organizationId],
      ), "tenant-session")
      throw error
    }
    return NextResponse.json({ ok: true, phone: selected.display_phone_number || null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na autorização da Meta." }, { status: 400 })
  }
}
