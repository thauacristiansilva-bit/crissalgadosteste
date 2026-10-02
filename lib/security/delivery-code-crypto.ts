import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto"

export type DeliveryChannel = "email" | "sms"
export const DELIVERY_CODE_TTL_SECONDS = 300
export const DELIVERY_CODE_MAX_ATTEMPTS = 5

export function deliveryChannel(value: unknown): DeliveryChannel {
  if (value !== "email" && value !== "sms") throw new Error("Escolha e-mail ou SMS.")
  return value
}

export function normalizeDeliveryPhone(value: unknown) {
  if (typeof value !== "string" || value.length > 40) throw new Error("Informe o telefone com DDD.")
  const digits = value.replace(/\D/g, "")
  const international = value.trim().startsWith("+") || (digits.startsWith("55") && digits.length >= 12)
    ? `+${digits}` : `+55${digits}`
  if (!/^\+[1-9]\d{7,14}$/.test(international)) throw new Error("Informe um telefone válido com DDD e código do país.")
  if (international.startsWith("+55") && !/^\+55[1-9]\d{9,10}$/.test(international)) throw new Error("Informe o telefone brasileiro completo com DDD.")
  return international
}

export function maskedRecipient(channel: DeliveryChannel, value: string) {
  if (channel === "sms") return `${value.slice(0, 3)} •••• ${value.slice(-4)}`
  const [name, domain] = value.split("@")
  return `${name.slice(0, 1)}•••@${domain}`
}

export function newDeliveryCode() { return String(randomInt(0, 1_000_000)).padStart(6, "0") }
export function deliveryBinding(value: string) { return createHash("sha256").update(value).digest("hex") }
export function hashDeliveryCode(secret: string, id: string, userId: string, binding: string, code: string) {
  if (!secret) throw new Error("SESSION_SECRET não configurado.")
  return createHmac("sha256", secret).update(JSON.stringify(["mfa-delivery-v1", id, userId, binding, code])).digest("hex")
}
export function codeHashesMatch(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) return false
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))
}
