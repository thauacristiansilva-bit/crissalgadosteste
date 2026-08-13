import { NextResponse } from "next/server"
import {
  assertOrganizationEntitlement,
  billingErrorStatus,
} from "@/lib/billing-db"
import { buildManagementReport, canAccessManagementReports } from "@/lib/reports-db"
import type { ManagementReportScope } from "@/lib/reports-types"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessManagementReports(session)) return NextResponse.json({ error: "Seu perfil não possui acesso aos relatórios gerenciais." }, { status: 403 })

  try {
    await assertOrganizationEntitlement(session.organizationId, "advancedReports")
    const url = new URL(request.url)
    const scope: ManagementReportScope = url.searchParams.get("scope") === "group" ? "group" : "organization"
    const report = await buildManagementReport(
      session,
      scope,
      url.searchParams.get("start"),
      url.searchParams.get("end"),
    )
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar relatório gerencial." },
      { status: billingErrorStatus(error) || 400 },
    )
  }
}
