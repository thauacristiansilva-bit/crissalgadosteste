import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { runWithRlsUserContext } from "@/lib/rls-context"
import { dispatchIntegrationMessage } from "@/lib/integration-providers"
import { codeHashesMatch, deliveryBinding, hashDeliveryCode, maskedRecipient, newDeliveryCode, DELIVERY_CODE_MAX_ATTEMPTS, DELIVERY_CODE_TTL_SECONDS, type DeliveryChannel } from "./delivery-code-crypto"

type Purpose = "enroll" | "login"
type CodeRow = { id: string; channel: DeliveryChannel; purpose: Purpose; recipient: string; binding_hash: string; code_hash: string; attempts: number; valid: boolean }

function secret() { const value = process.env.SESSION_SECRET?.trim(); if (!value) throw new Error("O envio seguro ainda não está configurado."); return value }

export function deliveryConfigured(channel: DeliveryChannel) {
  if (process.env.AUTH_DELIVERY_CODES_ENABLED !== "true") return false
  return channel === "email"
    ? Boolean(process.env.AUTH_RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim())
    : Boolean(process.env.AUTH_SMS_ACCOUNT_SID?.trim() && process.env.AUTH_SMS_AUTH_TOKEN?.trim() && process.env.AUTH_SMS_FROM?.trim())
}

async function transaction<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  return runWithRlsUserContext(userId, async () => {
    const client = await getPostgresPool().connect()
    try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result }
    catch (error) { await client.query("ROLLBACK"); throw error }
    finally { client.release() }
  })
}

export async function deliveryContacts(userId: string) {
  return runWithRlsUserContext(userId, async () => {
    const pool = getPostgresPool()
    const user = await pool.query<{ email: string | null }>("SELECT email FROM sf_users WHERE id=$1 AND status='active'", [userId])
    const email = user.rows[0]?.email?.trim().toLowerCase() || ""
    const contacts = await pool.query<{ channel: DeliveryChannel; recipient: string }>("SELECT channel,recipient FROM sf_mfa_delivery_contacts WHERE user_id=$1", [userId])
    return { email, channels: (["email", "sms"] as const).map((channel) => {
      const contact = contacts.rows.find((row) => row.channel === channel && (channel !== "email" || row.recipient.toLowerCase() === email))
      return { channel, configured: deliveryConfigured(channel), enrolled: Boolean(contact), destination: contact ? maskedRecipient(channel, contact.recipient) : channel === "email" && email ? maskedRecipient(channel, email) : "" }
    }) }
  })
}

export async function sendDeliveryCode(input: { userId: string; channel: DeliveryChannel; purpose: Purpose; binding: string; phone?: string }) {
  if (!deliveryConfigured(input.channel)) throw new Error("Este canal ainda não foi habilitado pelo responsável pelo SaborFlow.")
  const id = randomUUID()
  const code = newDeliveryCode()
  const bindingHash = deliveryBinding(input.binding)
  const hash = hashDeliveryCode(secret(), id, input.userId, bindingHash, code)
  const recipient = await transaction(input.userId, async (client) => {
    // Serializes sends across Railway replicas. Resends also count against the budget.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mfa-delivery:${input.userId}`])
    const state = await client.query<{ email: string | null }>("SELECT u.email FROM sf_users u JOIN sf_user_mfa m ON m.user_id=u.id WHERE u.id=$1 AND u.status='active' AND m.enabled=true", [input.userId])
    if (!state.rows[0]) throw new Error("Conclua a configuração do autenticador antes de cadastrar outros métodos.")
    const email = state.rows[0].email?.trim().toLowerCase() || ""
    let to = input.channel === "email" ? email : input.phone || ""
    if (input.purpose === "login") {
      const contact = await client.query<{ recipient: string }>("SELECT recipient FROM sf_mfa_delivery_contacts WHERE user_id=$1 AND channel=$2 FOR SHARE", [input.userId,input.channel])
      to = contact.rows[0]?.recipient || ""
      if (input.channel === "email" && to.toLowerCase() !== email) to = ""
    }
    if (!to || (input.channel === "email" && !/^\S+@\S+\.\S+$/.test(to))) throw new Error("Confirme este contato na área Segurança antes de usá-lo no login.")
    const usage = await client.query<{ recent: boolean; count: number }>("SELECT COALESCE(bool_or(created_at > now()-interval '60 seconds'),false) AS recent, count(*)::int AS count FROM sf_mfa_delivery_codes WHERE user_id=$1 AND created_at > now()-interval '1 hour'", [input.userId])
    if (usage.rows[0].recent) throw new Error("Aguarde 60 segundos antes de solicitar outro código.")
    if (usage.rows[0].count >= 10) throw new Error("Limite de envios atingido. Tente novamente em uma hora.")
    await client.query("DELETE FROM sf_mfa_delivery_codes WHERE user_id=$1 AND created_at < now()-interval '1 day'", [input.userId])
    await client.query("UPDATE sf_mfa_delivery_codes SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL", [input.userId,input.purpose])
    await client.query("INSERT INTO sf_mfa_delivery_codes(id,user_id,channel,purpose,recipient,binding_hash,code_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')", [id,input.userId,input.channel,input.purpose,to,bindingHash,hash])
    return to
  })
  try {
    await dispatchIntegrationMessage({
      provider: input.channel === "email" ? "resend" : "twilio", channel: input.channel, recipient,
      subject: "Seu código de acesso ao SaborFlow", message: `SaborFlow: seu código é ${code}. Válido por 5 minutos. Não compartilhe. Se você não solicitou, ignore esta mensagem.`, idempotencyKey: `mfa-delivery:${id}`,
      credentials: input.channel === "email" ? { apiKey: process.env.AUTH_RESEND_API_KEY } : { accountSid: process.env.AUTH_SMS_ACCOUNT_SID, authToken: process.env.AUTH_SMS_AUTH_TOKEN },
      settings: { from: input.channel === "email" ? process.env.AUTH_EMAIL_FROM : process.env.AUTH_SMS_FROM, defaultCountryCode: "55" },
    })
    await runWithRlsUserContext(input.userId, () => getPostgresPool().query("UPDATE sf_mfa_delivery_codes SET sent_at=now() WHERE id=$1 AND user_id=$2 AND used_at IS NULL", [id,input.userId]))
  } catch {
    await runWithRlsUserContext(input.userId, () => getPostgresPool().query("UPDATE sf_mfa_delivery_codes SET used_at=now() WHERE id=$1 AND user_id=$2", [id,input.userId])).catch(() => undefined)
    throw new Error("Não foi possível enviar o código. Confira seu contato ou peça ajuda ao responsável pelo SaborFlow.")
  }
  return { id, destination: maskedRecipient(input.channel,recipient), expiresInSeconds: DELIVERY_CODE_TTL_SECONDS }
}

export async function consumeDeliveryCode(input: { userId: string; id: string; code: string; purpose: Purpose; binding: string }) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.id) || !/^\d{6}$/.test(input.code)) return false
  const bindingHash = deliveryBinding(input.binding)
  return transaction(input.userId, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mfa-delivery:${input.userId}`])
    const result = await client.query<CodeRow>("SELECT id,channel,purpose,recipient,binding_hash,code_hash,attempts,(expires_at>now() AND used_at IS NULL AND sent_at IS NOT NULL) AS valid FROM sf_mfa_delivery_codes WHERE id=$1 AND user_id=$2 FOR UPDATE", [input.id,input.userId])
    const row = result.rows[0]
    if (!row || !row.valid || row.purpose !== input.purpose || row.binding_hash !== bindingHash || row.attempts >= DELIVERY_CODE_MAX_ATTEMPTS || !deliveryConfigured(row.channel)) return false
    const state = await client.query<{ email: string | null }>("SELECT u.email FROM sf_users u JOIN sf_user_mfa m ON m.user_id=u.id WHERE u.id=$1 AND u.status='active' AND m.enabled=true", [input.userId])
    if (!state.rows[0] || (row.channel === "email" && row.recipient.toLowerCase() !== state.rows[0].email?.trim().toLowerCase())) return false
    if (input.purpose === "login") {
      const contact = await client.query("SELECT 1 FROM sf_mfa_delivery_contacts WHERE user_id=$1 AND channel=$2 AND recipient=$3 FOR SHARE", [input.userId,row.channel,row.recipient])
      if (!contact.rowCount) return false
    }
    if (!codeHashesMatch(row.code_hash, hashDeliveryCode(secret(),row.id,input.userId,bindingHash,input.code))) {
      await client.query("UPDATE sf_mfa_delivery_codes SET attempts=attempts+1 WHERE id=$1", [row.id])
      return false
    }
    await client.query("UPDATE sf_mfa_delivery_codes SET used_at=now() WHERE id=$1", [row.id])
    if (input.purpose === "enroll") {
      await client.query("INSERT INTO sf_mfa_delivery_contacts(user_id,channel,recipient) VALUES($1,$2,$3) ON CONFLICT(user_id,channel) DO UPDATE SET recipient=EXCLUDED.recipient,verified_at=now(),updated_at=now()", [input.userId,row.channel,row.recipient])
    }
    return true
  })
}

export async function removeDeliveryContact(userId: string, channel: DeliveryChannel) {
  await transaction(userId, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mfa-delivery:${userId}`])
    await client.query("DELETE FROM sf_mfa_delivery_contacts WHERE user_id=$1 AND channel=$2", [userId,channel])
    await client.query("UPDATE sf_mfa_delivery_codes SET used_at=now() WHERE user_id=$1 AND channel=$2 AND used_at IS NULL", [userId,channel])
  })
}
