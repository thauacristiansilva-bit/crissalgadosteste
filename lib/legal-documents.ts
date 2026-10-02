export const TERMS_VERSION = "2026-10-02-v2"
export const PRIVACY_VERSION = "2026-08-25-v1"
export const SUBSCRIPTION_CONTRACT_VERSION = "2026-10-02-v2"
export const LEGAL_LAST_UPDATED = "2 de outubro de 2026"

export const CURRENT_LEGAL_VERSIONS = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  subscriptionContract: SUBSCRIPTION_CONTRACT_VERSION,
} as const

export type LegalAcceptanceSource =
  | "public-contracting-password"
  | "public-contracting-google"
  | "commercial-checkout"
  | "admin-legal-gate"
  | "store-customer-register"
