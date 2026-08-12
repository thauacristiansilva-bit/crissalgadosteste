import type { BillingCycle } from "@/lib/billing-types"
import { createMercadoPagoBillingProvider } from "@/lib/billing-providers/mercado-pago"

export type ProviderCheckoutInput = {
  checkoutSessionId: string
  localSubscriptionId: string
  planCode: string
  planName: string
  billingCycle: BillingCycle
  amountCents: number
  currency: string
  payerEmail: string
  returnUrl: string
}

export type ProviderCheckoutResult = {
  provider: string
  providerCheckoutId: string | null
  providerSubscriptionId: string
  checkoutUrl: string
  providerStatus: string
  raw: unknown
}

export type ProviderSubscriptionSnapshot = {
  provider: string
  id: string
  status: string
  externalReference: string | null
  payerEmail: string | null
  nextPaymentDate: string | null
  raw: unknown
}

export interface BillingProvider {
  name: string
  configured(): boolean
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>
  getSubscription(id: string): Promise<ProviderSubscriptionSnapshot>
}

export function configuredBillingProviderName() {
  return (process.env.BILLING_PROVIDER || "").trim().toLowerCase()
}

export function getBillingProvider(name = configuredBillingProviderName()): BillingProvider {
  if (!name) {
    throw new Error("BILLING_PROVIDER não foi configurado.")
  }
  if (name === "mercado_pago" || name === "mercadopago") {
    return createMercadoPagoBillingProvider()
  }
  throw new Error(`Provedor de cobrança não suportado: ${name}.`)
}

export function billingProviderConfiguration() {
  const name = configuredBillingProviderName()
  if (!name) return { provider: null, configured: false }
  try {
    const provider = getBillingProvider(name)
    return { provider: provider.name, configured: provider.configured() }
  } catch {
    return { provider: name, configured: false }
  }
}
