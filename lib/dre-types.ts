export type DreExpenseGroupKey =
  | "personnel"
  | "occupancy"
  | "utilities"
  | "marketing"
  | "logistics"
  | "financial"
  | "taxes"
  | "administrative"
  | "maintenance"
  | "inventoryLosses"
  | "other"

export interface DreExpenseGroup {
  key: DreExpenseGroupKey
  label: string
  amount: number
}

export interface DreDailyPoint {
  date: string
  netSales: number
  otherIncome: number
  cmv: number
  expenses: number
  netResult: number
}

export interface DreComparisonSummary {
  start: string
  end: string
  netRevenue: number
  cmv: number
  grossProfit: number
  operatingExpenses: number
  netResult: number
  grossMarginPercent: number
  netMarginPercent: number
  deltas: {
    netRevenuePercent: number | null
    grossProfitPercent: number | null
    netResultPercent: number | null
  }
}

export interface DreReport {
  ok: true
  phase: 13
  regime: "competencia-gerencial"
  period: {
    start: string
    end: string
    timeZone: string
  }
  revenue: {
    productSales: number
    deliveryRevenue: number
    grossRevenue: number
    discounts: number
    netSales: number
    otherIncome: number
    netRevenue: number
    paidSales: number
    unpaidSales: number
    cancelledOrders: number
    cancelledAmount: number
  }
  costs: {
    cmv: number
    waste: number
  }
  result: {
    grossProfit: number
    operatingExpenses: number
    operatingResult: number
    netResult: number
    grossMarginPercent: number
    netMarginPercent: number
    cmvPercent: number
    averageTicket: number
    orderCount: number
  }
  expenses: DreExpenseGroup[]
  daily: DreDailyPoint[]
  dataQuality: {
    foodCompositionReady: boolean
    ordersWithCmv: number
    cmvCoveragePercent: number
    manualEntries: number
    cmvComplete: boolean
    note: string
  }
  comparison: DreComparisonSummary | null
}

export interface DreHealth {
  ok: boolean
  phase: 13
  organizationId: string
  sources: {
    orders: boolean
    financialEntries: boolean
    inventoryMovements: boolean
    foodCompositionState: boolean
  }
  cmv: {
    ready: boolean
    foodCompositionReady: boolean
  }
  regime: "competencia-gerencial"
  note: string
}
