import {
  assertOrganizationEntitlement,
  billingErrorStatus,
} from "@/lib/billing-db"
import { reportToCsv, type ReportExportDataset } from "@/lib/reports-csv"
import { buildManagementReport, canAccessManagementReports } from "@/lib/reports-db"
import type { ManagementReportScope } from "@/lib/reports-types"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const datasets = new Set<ReportExportDataset>(["summary", "products", "daily", "units"])

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) return new Response("Não autorizado.", { status: 401 })
  if (!canAccessManagementReports(session)) return new Response("Seu perfil não possui acesso aos relatórios gerenciais.", { status: 403 })

  try {
    await assertOrganizationEntitlement(session.organizationId, "advancedReports")
    const url = new URL(request.url)
    const scope: ManagementReportScope = url.searchParams.get("scope") === "group" ? "group" : "organization"
    const requestedDataset = (url.searchParams.get("dataset") || "summary") as ReportExportDataset
    const dataset: ReportExportDataset = datasets.has(requestedDataset) ? requestedDataset : "summary"
    const report = await buildManagementReport(
      session,
      scope,
      url.searchParams.get("start"),
      url.searchParams.get("end"),
    )
    const csv = reportToCsv(report, dataset)
    const filename = `saborflow-${scope}-${dataset}-${report.period.start}-${report.period.end}.csv`
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao exportar relatório.", {
      status: billingErrorStatus(error) || 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}
