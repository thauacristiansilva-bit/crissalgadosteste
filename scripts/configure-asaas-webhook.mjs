import process from "node:process"

const apiKey = (process.env.ASAAS_API_KEY || "").trim()
const authToken = (process.env.ASAAS_WEBHOOK_TOKEN || "").trim()
const email = (process.env.ASAAS_WEBHOOK_EMAIL || "").trim()
const baseUrl = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "")
const environment = (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox"

if (!apiKey) throw new Error("ASAAS_API_KEY não está configurada.")
if (!authToken || authToken.length < 32) throw new Error("ASAAS_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres.")
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("ASAAS_WEBHOOK_EMAIL deve ser um e-mail válido.")
if (!/^https:\/\//i.test(baseUrl)) throw new Error("APP_BASE_URL precisa ser a URL pública HTTPS do SaborFlow.")
if (environment === "production" && !apiKey.startsWith("$aact_prod_")) throw new Error("A chave configurada não parece ser de Produção.")
if (environment === "sandbox" && !apiKey.startsWith("$aact_hmlg_")) throw new Error("A chave configurada não parece ser do Sandbox.")

const apiBase = environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"
const webhookUrl = `${baseUrl}/api/billing/webhooks/asaas`
const events = [
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "SUBSCRIPTION_INACTIVATED",
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
]

async function request(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      accept: "application/json",
      "content-type": "application/json",
      "User-Agent": `SaborFlow/1.0 (${environment})`,
      ...(init.headers || {}),
    },
  })
  const raw = await response.text()
  let payload
  try { payload = raw ? JSON.parse(raw) : null } catch { payload = raw }
  if (!response.ok) {
    console.error(payload)
    throw new Error(`Asaas respondeu HTTP ${response.status}.`)
  }
  return payload
}

const list = await request("/webhooks?offset=0&limit=100")
const existing = (list?.data || []).find((item) => item.url === webhookUrl)
  || (list?.data || []).find((item) => item.name === "SaborFlow Billing")

const commonBody = {
  name: "SaborFlow Billing",
  url: webhookUrl,
  enabled: true,
  interrupted: false,
  authToken,
  sendType: "SEQUENTIALLY",
  events,
}

const result = existing?.id
  ? await request(`/webhooks/${encodeURIComponent(existing.id)}`, { method: "PUT", body: JSON.stringify(commonBody) })
  : await request("/webhooks", { method: "POST", body: JSON.stringify({ ...commonBody, email, apiVersion: 3 }) })

console.log(JSON.stringify({
  ok: true,
  action: existing?.id ? "updated" : "created",
  environment,
  webhookUrl,
  webhookId: result?.id || existing?.id || null,
  events,
}, null, 2))
