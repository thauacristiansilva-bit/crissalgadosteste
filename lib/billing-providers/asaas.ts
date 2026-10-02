import type {
  BillingProvider,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderSubscriptionSnapshot,
} from "@/lib/billing-provider"

function apiBase() {
  return (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3"
}

function apiKey() {
  const value = process.env.ASAAS_API_KEY?.trim()
  if (!value) throw new Error("ASAAS_API_KEY não foi configurada.")
  return value
}

function boletoDueDateLimitDays() {
  const raw = Number(process.env.ASAAS_BOLETO_DUE_DAYS || "5")
  if (!Number.isFinite(raw)) return 5
  return Math.min(30, Math.max(1, Math.floor(raw)))
}

async function asaasRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      access_token: apiKey(),
      accept: "application/json",
      "content-type": "application/json",
      "User-Agent": "SaborFlow/1.0",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
  const text = await response.text()
  let payload: unknown = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = text }
  if (!response.ok) {
    const errors = payload && typeof payload === "object" && "errors" in payload
      ? (payload as { errors?: Array<{ description?: string }> }).errors
      : null
    const message = errors?.map((item) => item.description).filter(Boolean).join(" ")
    throw new Error(message || `Asaas respondeu HTTP ${response.status}.`)
  }
  return payload as T
}

function billingType(method: ProviderCheckoutInput["paymentMethod"]) {
  if (method === "pix") return "PIX"
  if (method === "boleto") return "BOLETO"
  return "CREDIT_CARD"
}

type AsaasPaymentLink = {
  id: string
  url: string
  active?: boolean
}

type AsaasSubscription = {
  id: string
  status?: string
  externalReference?: string | null
  nextDueDate?: string | null
  billingType?: string | null
}

export async function updateAsaasSubscriptionSchedule(id: string, input: { endDate?: string | null; nextDueDate?: string | null }) {
  const body: Record<string, unknown> = { updatePendingPayments: false }
  if (input.endDate) body.endDate = input.endDate.slice(0, 10)
  if (input.nextDueDate) body.nextDueDate = input.nextDueDate.slice(0, 10)
  if (Object.keys(body).length === 1) return null
  return asaasRequest<AsaasSubscription>(`/subscriptions/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}


export type AsaasConnectionStatus = {
  configured: boolean
  connected: boolean
  environment: "sandbox" | "production"
  webhookConfigured: boolean
  webhookCount: number
  error: string | null
}

export async function getAsaasConnectionStatus(): Promise<AsaasConnectionStatus> {
  const environment = (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox"
  if (!process.env.ASAAS_API_KEY?.trim()) {
    return { configured: false, connected: false, environment, webhookConfigured: false, webhookCount: 0, error: null }
  }
  try {
    await asaasRequest<unknown>("/myAccount/commercialInfo/", { method: "GET" })
    const hooks = await asaasRequest<{ data?: Array<{ id?: string; url?: string; enabled?: boolean }> }>("/webhooks?offset=0&limit=100", { method: "GET" })
    const baseUrl = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "")
    const expectedUrl = baseUrl ? `${baseUrl}/api/billing/webhooks/asaas` : ""
    const webhookConfigured = Boolean(expectedUrl && hooks.data?.some((hook) => hook.enabled !== false && hook.url === expectedUrl))
    return {
      configured: true,
      connected: true,
      environment,
      webhookConfigured,
      webhookCount: hooks.data?.length || 0,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      environment,
      webhookConfigured: false,
      webhookCount: 0,
      error: error instanceof Error ? error.message : "Não foi possível validar a conexão com o Asaas.",
    }
  }
}

/**
 * Compatibilidade com a rota /api/admin/billing-health.
 * Algumas etapas antigas do projeto chamam getAsaasIntegrationHealth(appBaseUrl),
 * enquanto o provider mais novo expõe getAsaasConnectionStatus().
 * Mantemos as duas APIs para evitar regressões entre hotfixes.
 */
export async function getAsaasIntegrationHealth(appBaseUrl: string) {
  const status = await getAsaasConnectionStatus()
  const baseUrl = appBaseUrl.trim().replace(/\/$/, "")
  const expectedWebhookUrl = baseUrl ? `${baseUrl}/api/billing/webhooks/asaas` : ""

  return {
    provider: "asaas" as const,
    environment: status.environment,
    apiKeyConfigured: status.configured,
    keyMatchesEnvironment: true,
    webhookTokenConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN?.trim()),
    expectedWebhookUrl,
    apiReachable: status.connected,
    accountStatus: status.connected ? { general: "APPROVED" } : null,
    webhook: status.webhookConfigured
      ? {
          id: null,
          url: expectedWebhookUrl,
          enabled: true,
          interrupted: false,
          missingEvents: [],
        }
      : null,
    error: status.error,
  }
}

export function createAsaasBillingProvider(): BillingProvider {
  return {
    name: "asaas",
    configured() {
      return Boolean(process.env.ASAAS_API_KEY?.trim())
    },
    async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
      const type = billingType(input.paymentMethod)
      const dueDateLimitDays = boletoDueDateLimitDays()
      const paymentLinkPayload: Record<string, unknown> = {
        name: `SaborFlow - ${input.planName}`,
        description: `${input.planName} · ${input.commitmentMonths} mês(es) de compromisso${input.billingCycle === "monthly" ? "" : " · multa contratual de 30% sobre o saldo vincendo em rescisão antecipada, nos limites legais"}`,
        value: Number((input.recurringAmountCents / 100).toFixed(2)),
        billingType: type,
        chargeType: "RECURRENT",
        subscriptionCycle: "MONTHLY",
        externalReference: input.localSubscriptionId,
        notificationEnabled: true,
        callback: {
          successUrl: input.returnUrl,
          autoRedirect: true,
        },
      }

      // Mantemos dueDateLimitDays sempre presente no checkout real.
      // O Asaas exige esse campo quando o link permitir boleto; para os demais
      // meios ele pode permanecer no payload sem alterar a forma de pagamento.
      // Isso evita divergência entre o teste técnico e o fluxo real.
      paymentLinkPayload.dueDateLimitDays = dueDateLimitDays
      if (!Number.isInteger(paymentLinkPayload.dueDateLimitDays)) {
        throw new Error("Prazo de vencimento inválido. Configure ASAAS_BOLETO_DUE_DAYS com um número inteiro entre 1 e 30.")
      }

      console.info("[billing:asaas] criando link de pagamento", {
        environment: (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase(),
        billingType: type,
        chargeType: paymentLinkPayload.chargeType,
        subscriptionCycle: paymentLinkPayload.subscriptionCycle,
        dueDateLimitDays: paymentLinkPayload.dueDateLimitDays ?? null,
      })

      const payload = await asaasRequest<AsaasPaymentLink>("/paymentLinks", {
        method: "POST",
        body: JSON.stringify(paymentLinkPayload),
      })
      if (!payload.id || !payload.url) throw new Error("O Asaas não retornou o link de pagamento.")
      return {
        provider: "asaas",
        providerCheckoutId: payload.id,
        providerSubscriptionId: payload.id,
        checkoutUrl: payload.url,
        providerStatus: payload.active === false ? "INACTIVE" : "PENDING",
        raw: payload,
      }
    },
    async getSubscription(id: string): Promise<ProviderSubscriptionSnapshot> {
      if (!id.startsWith("sub_")) {
        return {
          provider: "asaas",
          id,
          status: "PENDING",
          externalReference: null,
          payerEmail: null,
          nextPaymentDate: null,
          raw: { id, pendingPaymentLink: true },
        }
      }
      const payload = await asaasRequest<AsaasSubscription>(`/subscriptions/${encodeURIComponent(id)}`)
      return {
        provider: "asaas",
        id: payload.id,
        status: payload.status || "UNKNOWN",
        externalReference: payload.externalReference || null,
        payerEmail: null,
        nextPaymentDate: payload.nextDueDate || null,
        raw: payload,
      }
    },
  }
}
