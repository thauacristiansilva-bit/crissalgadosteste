export const TERMS_VERSION = "2026-08-25-v1"
export const PRIVACY_VERSION = "2026-08-25-v1"
export const LEGAL_LAST_UPDATED = "25 de agosto de 2026"

export const CURRENT_LEGAL_VERSIONS = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
} as const

export type LegalAcceptanceSource =
  | "public-contracting-password"
  | "public-contracting-google"
  | "admin-legal-gate"
  | "store-customer-register"
