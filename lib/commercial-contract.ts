import type { BillingCycle } from "@/lib/billing-types"

export const EARLY_TERMINATION_PENALTY_PERCENT = 30

export const SABORFLOW_FIXED_PRICING = {
  monthly: {
    contractTotalCents: 9_990,
    installmentCents: 9_990,
    commitmentMonths: 1,
    label: "Mensal",
  },
  semiannual: {
    contractTotalCents: 53_940,
    installmentCents: 8_990,
    commitmentMonths: 6,
    label: "Semestral",
  },
  annual: {
    contractTotalCents: 95_880,
    installmentCents: 7_990,
    commitmentMonths: 12,
    label: "Anual",
  },
} as const satisfies Record<BillingCycle, {
  contractTotalCents: number
  installmentCents: number
  commitmentMonths: number
  label: string
}>

export const MONTHLY_TOTAL_CENTS = SABORFLOW_FIXED_PRICING.monthly.contractTotalCents
export const SEMIANNUAL_TOTAL_CENTS = SABORFLOW_FIXED_PRICING.semiannual.contractTotalCents
export const ANNUAL_TOTAL_CENTS = SABORFLOW_FIXED_PRICING.annual.contractTotalCents

export function commercialCycleTerms(cycle: BillingCycle) {
  return SABORFLOW_FIXED_PRICING[cycle]
}

export function earlyTerminationPenaltyCents(input: {
  cycle: BillingCycle
  remainingInstallments: number
}) {
  const terms = commercialCycleTerms(input.cycle)
  const remaining = Math.max(0, Math.floor(input.remainingInstallments))
  const remainingBalance = remaining * terms.installmentCents
  return Math.round(remainingBalance * (EARLY_TERMINATION_PENALTY_PERCENT / 100))
}

export function commitmentEndDate(startIso: string | null | undefined, cycle: BillingCycle) {
  if (cycle === "monthly") return null
  const start = startIso ? new Date(startIso) : new Date()
  const result = new Date(start)
  result.setUTCMonth(result.getUTCMonth() + commercialCycleTerms(cycle).commitmentMonths)
  return result.toISOString()
}

export function providerBillingEndDate(contractEndIso: string | null | undefined, cycle: BillingCycle) {
  if (!contractEndIso || cycle === "monthly") return null
  const result = new Date(contractEndIso)
  result.setUTCMonth(result.getUTCMonth() - 1)
  return result.toISOString()
}

export function nextRecurringDueDateAfterTrial(startIso: string | null | undefined) {
  if (!startIso) return null
  const result = new Date(startIso)
  result.setUTCMonth(result.getUTCMonth() + 1)
  return result.toISOString()
}
