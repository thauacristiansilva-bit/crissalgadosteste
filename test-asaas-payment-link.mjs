const environment = (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase()
if (environment !== "sandbox") {
  throw new Error("Este teste só pode ser executado com ASAAS_ENV=sandbox para evitar cobrança em produção.")
}
const apiKey = process.env.ASAAS_API_KEY?.trim()
if (!apiKey) throw new Error("ASAAS_API_KEY não configurada.")
const rawDays = Number(process.env.ASAAS_BOLETO_DUE_DAYS || "5")
const dueDateLimitDays = Number.isFinite(rawDays) ? Math.min(30, Math.max(1, Math.floor(rawDays))) : 5

const body = {
  name: "SaborFlow - teste técnico boleto",
  description: "Link técnico temporário para validar integração Sandbox",
  value: 5,
  billingType: "BOLETO",
  chargeType: "RECURRENT",
  subscriptionCycle: "MONTHLY",
  dueDateLimitDays,
  notificationEnabled: false,
}

console.log("Payload seguro:", JSON.stringify(body, null, 2))
const response = await fetch("https://api-sandbox.asaas.com/v3/paymentLinks", {
  method: "POST",
  headers: {
    access_token: apiKey,
    accept: "application/json",
    "content-type": "application/json",
    "User-Agent": "SaborFlow/1.0",
  },
  body: JSON.stringify(body),
})
const text = await response.text()
let data
try { data = text ? JSON.parse(text) : null } catch { data = text }
if (!response.ok) {
  console.error(JSON.stringify({ ok: false, status: response.status, response: data }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, dueDateLimitDays, paymentLinkId: data?.id || null, url: data?.url || null }, null, 2))
