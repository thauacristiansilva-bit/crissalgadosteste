import type { ManagementReport } from "@/lib/reports-types"

function escape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function rowsToCsv(rows: Array<Array<unknown>>) {
  return `\uFEFF${rows.map((row) => row.map(escape).join(";")).join("\r\n")}\r\n`
}

export type ReportExportDataset = "summary" | "products" | "daily" | "units"

export function reportToCsv(report: ManagementReport, dataset: ReportExportDataset) {
  if (dataset === "products") {
    return rowsToCsv([
      ["Produto", "Quantidade", "Pedidos", "Faturamento", "Participação %"],
      ...report.products.map((item) => [item.name, item.quantity, item.orders, item.revenue, item.sharePercent]),
    ])
  }

  if (dataset === "daily") {
    return rowsToCsv([
      ["Data", "Pedidos", "Faturamento", "Ticket médio"],
      ...report.daily.map((item) => [item.date, item.orders, item.revenue, item.averageTicket]),
    ])
  }

  if (dataset === "units") {
    return rowsToCsv([
      ["Unidade", "Pedidos", "Faturamento", "Ticket médio", "Participação %"],
      ...report.units.map((item) => [item.name, item.orders, item.revenue, item.averageTicket, item.sharePercent]),
    ])
  }

  return rowsToCsv([
    ["Indicador", "Valor atual", "Período anterior", "Variação %"],
    ["Pedidos", report.comparison.orders.current, report.comparison.orders.previous, report.comparison.orders.percent ?? ""],
    ["Faturamento", report.comparison.revenue.current, report.comparison.revenue.previous, report.comparison.revenue.percent ?? ""],
    ["Ticket médio", report.comparison.averageTicket.current, report.comparison.averageTicket.previous, report.comparison.averageTicket.percent ?? ""],
    ["Pedidos concluídos", report.comparison.completedOrders.current, report.comparison.completedOrders.previous, report.comparison.completedOrders.percent ?? ""],
    ["Cancelamentos", report.metrics.cancelledOrders, "", report.metrics.cancellationRatePercent],
    ["Receita paga", report.metrics.paidRevenue, "", ""],
    ["Receita não paga", report.metrics.unpaidRevenue, "", ""],
    ["Descontos", report.metrics.discounts, "", ""],
    ["Receita de entrega", report.metrics.deliveryRevenue, "", ""],
    ["Entradas financeiras manuais", report.metrics.manualIncome, "", ""],
    ["Despesas financeiras manuais", report.metrics.manualExpenses, "", ""],
  ])
}
