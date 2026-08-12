import type {
  BillingProvider,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderSubscriptionSnapshot,
} from "@/lib/billing-provider"

const API_BASE = "https://api.mercadopago.com"

function accessToken() {
  const value = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()
  if (!value) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não foi configurado.")
  return value
}

async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message || "")
      : ""
    throw new Error(message || `Mercado Pago respondeu HTTP ${response.status}.`)
  }
  return payload as T
}

type MercadoPagoPreapproval = {
  id: string
  init_point?: string
  status?: string
  external_reference?: string | number | null
  payer_email?: string | null
  next_payment_date?: string | null
}

export function createMercadoPagoBillingProvider(): BillingProvider {
  return {
    name: "mercado_pago",
    configured() {
      return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim())
    },
    async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
      const frequency = input.billingCycle === "annual" ? 12 : 1
      const payload = await mercadoPagoRequest<MercadoPagoPreapproval>("/preapproval", {
        method: "POST",
        body: JSON.stringify({
          reason: `SaborFlow - ${input.planName}`,
          external_reference: input.localSubscriptionId,
          payer_email: input.payerEmail,
          auto_recurring: {
            frequency,
            frequency_type: "months",
            transaction_amount: Number((input.amountCents / 100).toFixed(2)),
            currency_id: input.currency,
          },
          back_url: input.returnUrl,
          status: "pending",
        }),
      })
      if (!payload.id || !payload.init_point) {
        throw new Error("O provedor não retornou o link de pagamento da assinatura.")
      }
      return {
        provider: "mercado_pago",
        providerCheckoutId: payload.id,
        providerSubscriptionId: payload.id,
        checkoutUrl: payload.init_point,
        providerStatus: payload.status || "pending",
        raw: payload,
      }
    },
    async getSubscription(id: string): Promise<ProviderSubscriptionSnapshot> {
      const payload = await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${encodeURIComponent(id)}`)
      return {
        provider: "mercado_pago",
        id: payload.id,
        status: payload.status || "unknown",
        externalReference: payload.external_reference == null ? null : String(payload.external_reference),
        payerEmail: payload.payer_email || null,
        nextPaymentDate: payload.next_payment_date || null,
        raw: payload,
      }
    },
  }
}
