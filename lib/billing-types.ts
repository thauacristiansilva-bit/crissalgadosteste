export const PLAN_ENTITLEMENT_KEYS = [
  "maxOrganizations",
  "maxUsers",
  "maxProducts",
  "customDomain",
  "delivery",
  "kitchen",
  "financial",
  "loyalty",
  "modifiers",
  "inventory",
  "advancedReports",
  "integrations",
] as const

export type PlanEntitlementKey =
  (typeof PLAN_ENTITLEMENT_KEYS)[number]

export type SubscriptionStatus =
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"

export type BillingCycle = "monthly" | "annual"

export type PlanEntitlements = {
  maxOrganizations: number | null
  maxUsers: number | null
  maxProducts: number | null
  customDomain: boolean
  delivery: boolean
  kitchen: boolean
  financial: boolean
  loyalty: boolean
  modifiers: boolean
  inventory: boolean
  advancedReports: boolean
  integrations: boolean
}

export type BillingUsage = {
  organizations: number
  users: number
  products: number
}

export type CommercialPlan = {
  id: string
  code: string
  name: string
  description: string
  currency: string
  monthlyPriceCents: number | null
  annualPriceCents: number | null
  entitlements: PlanEntitlements
}

export type BillingSnapshot = {
  ready: boolean
  account: {
    id: string
    status: "active" | "suspended" | "closed"
    billingEmail: string | null
  } | null
  subscription: {
    id: string
    status: SubscriptionStatus
    planId: string
    planCode: string
    planName: string
    internal: boolean
    billingCycle?: BillingCycle | "manual" | null
    provider?: string | null
    currentPeriodEnd: string | null
    trialEndsAt: string | null
  } | null
  entitlements: PlanEntitlements
  usage: BillingUsage
  capacity: {
    canCreateOrganization: boolean
    canAddUser: boolean
    canCreateProduct: boolean
  }
}

export type CommercialBillingStatus = {
  authenticated: boolean
  email: string | null
  hasOrganization: boolean
  onboardingUnlocked: boolean
  billing: BillingSnapshot | null
  latestCheckout: {
    id: string
    status: "creating" | "pending" | "completed" | "failed" | "canceled" | "expired"
    checkoutUrl: string | null
    planCode: string
    planName: string
    billingCycle: BillingCycle
    subscriptionStatus: SubscriptionStatus
  } | null
}
