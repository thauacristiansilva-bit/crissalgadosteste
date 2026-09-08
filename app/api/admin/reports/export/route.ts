import {
  assertOrganizationEntitlement,
  billingErrorStatus,
} from "@/lib/billing-db"
import { reportToCsv, type ReportExportDataset } from "@/lib/reports-csv"
import { buildManagementReport, canAccessManagementReports } from "@/lib/reports-db"
import type { ManagementReportScope } from "@/lib/reports-types"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import {
  InputValidationError,
  optionalDate,
  validationErrorStatus,
} from "@/lib/security/input-validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const datasets = new Set<ReportExportDataset>(["summary", "products", "daily", "units"])

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) return new Response("Não autorizado.", { status: 401 })
  if (!canAccessManagementReports(session)) {
    return new Response("Seu perfil não possui acesso aos relatórios gerenciais.", { status: 403 })
  }

  try {
    await assertOrganizationEntitlement(session.organizationId, "advancedReports")
    const url = new URL(request.url)

    const rawScope = url.searchParams.get("scope")
    if (rawScope !== null && rawScope !== "organization" && rawScope !== "group") {
      throw new InputValidationError("Escopo de relatório inválido.")
    }
    const scope: ManagementReportScope = rawScope === "group" ? "group" : "organization"

    const rawDataset = url.searchParams.get("dataset")
    if (rawDataset !== null && !datasets.has(rawDataset as ReportExportDataset)) {
      throw new InputValidationError("Conjunto de dados inválido.")
    }
    const dataset = (rawDataset || "summary") as ReportExportDataset

    const start = optionalDate(url.searchParams.get("start"), "Data inicial")
    const end = optionalDate(url.searchParams.get("end"), "Data final")

    if ((start && !end) || (!start && end)) {
      throw new InputValidationError("Informe a data inicial e a data final.")
    }

    if (start && end && start > end) {
      throw new InputValidationError("A data inicial não pode ser posterior à data final.")
    }

    const report = await buildManagementReport(
      session,
      scope,
      start,
      end,
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
    return new Response(
      error instanceof Error ? error.message : "Falha ao exportar relatório.",
      {
        status:
          error instanceof InputValidationError
            ? validationErrorStatus(error)
            : billingErrorStatus(error) || 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    )
  }
}
