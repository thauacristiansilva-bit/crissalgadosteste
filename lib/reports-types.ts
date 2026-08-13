export type ManagementReportScope = "organization" | "group"

export type ReportDelta = {
  current: number
  previous: number
  percent: number | null
}

export type ReportBreakdown = {
  key: string
  label: string
  orders: number
  revenue: number
  sharePercent: number
}

export type ReportProduct = {
  name: string
  quantity: number
  revenue: number
  orders: number
  sharePercent: number
}

export type ReportDailyPoint = {
  date: string
  orders: number
  revenue: number
  averageTicket: number
}

export type ReportUnit = {
  organizationId: string
  name: string
  orders: number
  revenue: number
  averageTicket: number
  sharePercent: number
}

export type ReportCustomer = {
  name: string
  orders: number
  revenue: number
  averageTicket: number
}

export type ManagementReport = {
  ok: true
  phase: "20-reports-intelligence"
  scope: {
    requested: ManagementReportScope
    groupAvailable: boolean
    organizationIds: string[]
    organizationNames: string[]
    timeZone: string
  }
  period: {
    start: string
    end: string
    previousStart: string
    previousEnd: string
    days: number
  }
  metrics: {
    orders: number
    completedOrders: number
    cancelledOrders: number
    cancellationRatePercent: number
    revenue: number
    paidRevenue: number
    unpaidRevenue: number
    averageTicket: number
    discounts: number
    deliveryRevenue: number
    manualIncome: number
    manualExpenses: number
    manualResult: number
  }
  comparison: {
    orders: ReportDelta
    revenue: ReportDelta
    averageTicket: ReportDelta
    completedOrders: ReportDelta
  }
  products: ReportProduct[]
  channels: ReportBreakdown[]
  payments: ReportBreakdown[]
  fulfillment: ReportBreakdown[]
  statuses: ReportBreakdown[]
  daily: ReportDailyPoint[]
  units: ReportUnit[]
  customers: {
    identifiedCustomers: number
    returningCustomers: number
    returningRatePercent: number
    top: ReportCustomer[]
  }
  insights: string[]
  boundaries: {
    readOnlyAnalytics: true
    tenantIsolationPreserved: true
    groupReadDoesNotGrantTenantWrite: true
    financialDetailsRemainInDre: true
    maxRangeDays: 366
  }
}

export type ReportsHealth = {
  schemaReady: boolean
  entitlementEnabled: boolean
  subscriptionActive: boolean
  groupAvailable: boolean
  sources: {
    orders: boolean
    orderItems: boolean
    financialEntries: boolean
    corporateGroups: boolean
  }
}
