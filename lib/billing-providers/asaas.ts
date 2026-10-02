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

export function createAsaasBillingProvider(): BillingProvider {
  return {
    name: "asaas",
    configured() {
      return Boolean(process.env.ASAAS_API_KEY?.trim())
    },
    async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
      const type = billingType(input.paymentMethod)
      const payload = await asaasRequest<AsaasPaymentLink>("/paymentLinks", {
        method: "POST",
        body: JSON.stringify({
          name: `SaborFlow - ${input.planName}`,
          description: `${input.planName} · ${input.commitmentMonths} mês(es) de compromisso${input.billingCycle === "monthly" ? "" : " · multa contratual de 30% sobre o saldo vincendo em rescisão antecipada, nos limites legais"}`,
          value: Number((input.recurringAmountCents / 100).toFixed(2)),
          billingType: type,
          chargeType: "RECURRENT",
          subscriptionCycle: "MONTHLY",
          externalReference: input.localSubscriptionId,
          notificationEnabled: true,
          ...(type === "BOLETO" ? { dueDateLimitDays: 5 } : {}),
          callback: {
            successUrl: input.returnUrl,
            autoRedirect: true,
          },
        }),
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
