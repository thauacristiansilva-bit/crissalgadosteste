import process from "node:process"

const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "")
const token = (process.env.INTEGRATION_WORKER_TOKEN || "").trim()
const limit = Math.max(1, Math.min(50, Number(process.env.INTEGRATION_WORKER_BATCH || "20") || 20))

if (!baseUrl) throw new Error("APP_BASE_URL não está configurada.")
if (!token) throw new Error("INTEGRATION_WORKER_TOKEN não está configurado.")

const response = await fetch(`${baseUrl}/api/internal/integrations/process`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ limit }),
})

const payload = await response.json().catch(() => ({}))
if (!response.ok) {
  throw new Error(payload?.error || `Worker respondeu HTTP ${response.status}.`)
}

console.log(JSON.stringify(payload))
