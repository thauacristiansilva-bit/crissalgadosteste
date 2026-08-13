import { createHmac } from "node:crypto"

export type IntegrationProvider = "resend" | "twilio" | "whatsapp_meta" | "webhook"
export type IntegrationChannel = "email" | "sms" | "whatsapp" | "webhook"

export type ProviderDispatchInput = {
  provider: IntegrationProvider
  channel: IntegrationChannel
  recipient: string
  subject?: string
  message: string
  idempotencyKey: string
  credentials: Record<string, unknown>
  settings: Record<string, unknown>
  payload?: Record<string, unknown>
}

export type ProviderDispatchResult = {
  providerMessageId: string | null
  providerStatus: string
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function required(value: unknown, label: string) {
  const result = text(value)
  if (!result) throw new Error(`${label} não foi configurado.`)
  return result
}

function errorFromResponse(status: number, body: string) {
  const compact = body.replace(/\s+/g, " ").trim().slice(0, 500)
  return new Error(`Provedor recusou o envio (${status})${compact ? `: ${compact}` : "."}`)
}

function e164(value: string, defaultCountryCode: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "")
    if (digits.length < 8 || digits.length > 15) throw new Error("Telefone do destinatário inválido.")
    return `+${digits}`
  }
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) throw new Error("Telefone do destinatário inválido.")
  const countryCode = defaultCountryCode.replace(/\D/g, "")
  if (!countryCode) throw new Error("Código do país não foi configurado para o canal telefônico.")
  return `+${digits.startsWith(countryCode) ? digits : `${countryCode}${digits}`}`
}

function allowedWebhookUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  if (url.protocol !== "https:") throw new Error("Webhook de saída exige HTTPS.")
  const allowed = new Set(
    (process.env.INTEGRATION_WEBHOOK_ALLOWED_HOSTS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
  if (!allowed.size || !allowed.has(url.hostname.toLowerCase())) {
    throw new Error("Host do webhook não está autorizado em INTEGRATION_WEBHOOK_ALLOWED_HOSTS.")
  }
  return url
}

async function dispatchResend(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const apiKey = required(input.credentials.apiKey, "Chave da Resend")
  const from = required(input.settings.from, "Remetente")
  if (!/^\S+@\S+\.\S+$/.test(input.recipient)) throw new Error("E-mail do destinatário inválido.")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey.slice(0, 250),
      "user-agent": "SaborFlow/18.23",
    },
    body: JSON.stringify({
      from,
      to: [input.recipient],
      subject: input.subject || "Mensagem",
      text: input.message,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const raw = await response.text()
  if (!response.ok) throw errorFromResponse(response.status, raw)
  const payload = raw ? JSON.parse(raw) as { id?: string } : {}
  return { providerMessageId: payload.id || null, providerStatus: "accepted" }
}

async function dispatchTwilio(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const accountSid = required(input.credentials.accountSid, "Account SID da Twilio")
  const authToken = required(input.credentials.authToken, "Auth Token da Twilio")
  const from = required(input.settings.from, "Número remetente")
  const countryCode = text(input.settings.defaultCountryCode)
  const to = e164(input.recipient, countryCode)
  const params = new URLSearchParams({ To: to, From: from, Body: input.message })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    },
  )
  const raw = await response.text()
  if (!response.ok) throw errorFromResponse(response.status, raw)
  const payload = raw ? JSON.parse(raw) as { sid?: string; status?: string } : {}
  return { providerMessageId: payload.sid || null, providerStatus: payload.status || "accepted" }
}

async function dispatchWhatsApp(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const accessToken = required(input.credentials.accessToken, "Access Token da Meta")
  const phoneNumberId = required(input.credentials.phoneNumberId, "Phone Number ID da Meta")
  const apiVersion = required(input.settings.apiVersion, "Versão da Graph API")
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error("Versão da Graph API inválida.")
  const countryCode = text(input.settings.defaultCountryCode)
  const templateName = required(input.settings.templateName, "Template aprovado do WhatsApp")
  const languageCode = required(input.settings.languageCode, "Idioma do template do WhatsApp")
  const to = e164(input.recipient, countryCode).replace(/^\+/, "")
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: input.message }],
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const raw = await response.text()
  if (!response.ok) throw errorFromResponse(response.status, raw)
  const payload = raw ? JSON.parse(raw) as { messages?: Array<{ id?: string }> } : {}
  return { providerMessageId: payload.messages?.[0]?.id || null, providerStatus: "accepted" }
}

async function dispatchWebhook(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const endpoint = allowedWebhookUrl(required(input.settings.endpointUrl, "Endpoint do webhook"))
  const signingSecret = required(input.credentials.signingSecret, "Segredo de assinatura")
  const event = {
    id: input.idempotencyKey,
    type: "saborflow.integration.message",
    channel: input.channel,
    recipient: input.recipient,
    subject: input.subject || null,
    message: input.message,
    payload: input.payload || {},
    createdAt: new Date().toISOString(),
  }
  const body = JSON.stringify(event)
  const signature = createHmac("sha256", signingSecret).update(body).digest("hex")
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-saborflow-event-id": input.idempotencyKey,
      "x-saborflow-signature": `sha256=${signature}`,
      "user-agent": "SaborFlow/18.23",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })
  const raw = await response.text()
  if (!response.ok) throw errorFromResponse(response.status, raw)
  return { providerMessageId: null, providerStatus: `http-${response.status}` }
}

export async function dispatchIntegrationMessage(input: ProviderDispatchInput) {
  switch (input.provider) {
    case "resend":
      if (input.channel !== "email") throw new Error("A conexão Resend só pode enviar e-mail.")
      return dispatchResend(input)
    case "twilio":
      if (input.channel !== "sms") throw new Error("A conexão Twilio configurada nesta fase envia SMS.")
      return dispatchTwilio(input)
    case "whatsapp_meta":
      if (input.channel !== "whatsapp") throw new Error("A conexão Meta só pode enviar WhatsApp.")
      return dispatchWhatsApp(input)
    case "webhook":
      return dispatchWebhook(input)
    default:
      throw new Error("Provedor de integração não suportado.")
  }
}
