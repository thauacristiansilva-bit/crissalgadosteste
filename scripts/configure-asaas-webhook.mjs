import process from "node:process"

const apiKey = (process.env.ASAAS_API_KEY || "").trim()
const authToken = (process.env.ASAAS_WEBHOOK_TOKEN || "").trim()
const email = (process.env.ASAAS_WEBHOOK_EMAIL || "").trim()
const baseUrl = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "")
const environment = (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase()

if (!apiKey) throw new Error("ASAAS_API_KEY não está configurada.")
if (!authToken || authToken.length < 32) throw new Error("ASAAS_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres.")
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("ASAAS_WEBHOOK_EMAIL deve ser um e-mail válido.")
if (!/^https:\/\//i.test(baseUrl)) throw new Error("APP_BASE_URL precisa ser a URL pública HTTPS do SaborFlow.")

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

const response = await fetch(`${apiBase}/webhooks`, {
  method: "POST",
  headers: {
    access_token: apiKey,
    accept: "application/json",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    name: "SaborFlow Billing",
    url: webhookUrl,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: "SEQUENTIALLY",
    events,
  }),
})

const raw = await response.text()
let payload
try { payload = raw ? JSON.parse(raw) : null } catch { payload = raw }
if (!response.ok) {
  console.error(payload)
  throw new Error(`Asaas respondeu HTTP ${response.status} ao criar o webhook.`)
}

console.log(JSON.stringify({ ok: true, environment, webhookUrl, events, response: payload }, null, 2))
