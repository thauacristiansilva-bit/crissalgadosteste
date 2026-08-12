import { createHmac, timingSafeEqual } from "node:crypto"

function parseSignature(header: string) {
  const values = new Map<string, string>()
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((item) => item.trim())
    if (key && value) values.set(key, value)
  }
  return { ts: values.get("ts") || "", v1: values.get("v1") || "" }
}

function safeHexEqual(actual: string, expected: string) {
  if (!/^[a-f0-9]+$/i.test(actual) || !/^[a-f0-9]+$/i.test(expected)) return false
  const a = Buffer.from(actual, "hex")
  const b = Buffer.from(expected, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

export function validateMercadoPagoWebhookSignature(input: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
  if (!secret) throw new Error("MERCADO_PAGO_WEBHOOK_SECRET não foi configurado.")
  if (!input.xSignature) return false

  const { ts, v1 } = parseSignature(input.xSignature)
  if (!ts || !v1) return false

  const pieces: string[] = []
  if (input.dataId) pieces.push(`id:${input.dataId.toLowerCase()};`)
  if (input.xRequestId) pieces.push(`request-id:${input.xRequestId};`)
  pieces.push(`ts:${ts};`)
  const manifest = pieces.join("")

  const calculated = createHmac("sha256", secret).update(manifest).digest("hex")
  if (!safeHexEqual(calculated, v1)) return false

  const maxAge = Number(process.env.BILLING_WEBHOOK_MAX_AGE_SECONDS || "900")
  if (Number.isFinite(maxAge) && maxAge > 0) {
    const timestamp = Number(ts)
    if (!Number.isFinite(timestamp)) return false
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp)
    if (age > maxAge) return false
  }
  return true
}
