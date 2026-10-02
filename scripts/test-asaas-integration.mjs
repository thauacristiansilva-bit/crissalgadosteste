import process from "node:process"

const apiKey = (process.env.ASAAS_API_KEY || "").trim()
const baseUrl = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "")
const environment = (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox"
const webhookToken = (process.env.ASAAS_WEBHOOK_TOKEN || "").trim()

if (!apiKey) throw new Error("ASAAS_API_KEY não está configurada.")
if (!/^https:\/\//i.test(baseUrl)) throw new Error("APP_BASE_URL precisa ser uma URL HTTPS pública.")
if (environment === "production" && !apiKey.startsWith("$aact_prod_")) throw new Error("ASAAS_ENV=production, mas a chave não parece ser de Produção.")
if (environment === "sandbox" && !apiKey.startsWith("$aact_hmlg_")) throw new Error("ASAAS_ENV=sandbox, mas a chave não parece ser do Sandbox.")

const apiBase = environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"
const expectedWebhookUrl = `${baseUrl}/api/billing/webhooks/asaas`

async function get(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      access_token: apiKey,
      accept: "application/json",
      "User-Agent": `SaborFlow/1.0 (${environment})`,
    },
  })
  const raw = await response.text()
  let payload
  try { payload = raw ? JSON.parse(raw) : null } catch { payload = raw }
  if (!response.ok) throw new Error(`Asaas respondeu HTTP ${response.status}: ${typeof payload === "string" ? payload : JSON.stringify(payload)}`)
  return payload
}

const [status, webhooks] = await Promise.all([
  get("/myAccount/status/"),
  get("/webhooks?offset=0&limit=100"),
])

const webhook = (webhooks?.data || []).find((item) => item.url === expectedWebhookUrl)
  || (webhooks?.data || []).find((item) => item.name === "SaborFlow Billing")

const result = {
  ok: Boolean(status && webhook && webhook.enabled !== false && webhook.interrupted !== true && webhookToken.length >= 32),
  environment,
  api: "connected",
  accountGeneralStatus: status?.general || null,
  webhook: webhook ? {
    id: webhook.id,
    url: webhook.url,
    enabled: webhook.enabled !== false,
    interrupted: webhook.interrupted === true,
    events: webhook.events || [],
  } : null,
  expectedWebhookUrl,
  webhookTokenConfigured: webhookToken.length >= 32,
}

console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 2
