import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ENVELOPE_VERSION = "v1"

function encryptionKey() {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error("INTEGRATION_ENCRYPTION_KEY não foi configurada.")

  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex")
  try {
    const key = Buffer.from(raw, "base64")
    if (key.length === 32) return key
  } catch {}
  throw new Error("INTEGRATION_ENCRYPTION_KEY deve conter 32 bytes em Base64 ou 64 caracteres hexadecimais.")
}

export function integrationEncryptionConfigured() {
  try {
    return encryptionKey().length === 32
  } catch {
    return false
  }
}

export function encryptIntegrationCredentials(value: Record<string, unknown>) {
  const key = encryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const plain = Buffer.from(JSON.stringify(value), "utf8")
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENVELOPE_VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".")
}

export function decryptIntegrationCredentials(envelope: string) {
  const [version, ivRaw, tagRaw, payloadRaw] = String(envelope || "").split(".")
  if (version !== ENVELOPE_VERSION || !ivRaw || !tagRaw || !payloadRaw) {
    throw new Error("Credenciais criptografadas em formato inválido.")
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64"))
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payloadRaw, "base64")),
    decipher.final(),
  ]).toString("utf8")
  const parsed = JSON.parse(plain)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Credenciais criptografadas inválidas.")
  }
  return parsed as Record<string, unknown>
}
