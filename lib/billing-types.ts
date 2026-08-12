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
}

export type BillingUsage = {
  organizations: number
  users: number
  products: number
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
