import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getTenantDreReport } from "@/lib/dre-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageFinance } from "@/lib/tenant-permissions"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function dateDiffDays(start: string, end: string) {
  const first = new Date(`${start}T12:00:00.000Z`).getTime()
  const last = new Date(`${end}T12:00:00.000Z`).getTime()
  return Math.floor((last - first) / 86_400_000) + 1
}

function defaultPeriod() {
  const end = new Date().toISOString().slice(0, 10)
  const startDate = new Date(`${end}T12:00:00.000Z`)
  startDate.setUTCDate(1)
  return { start: startDate.toISOString().slice(0, 10), end }
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "A DRE exige uma sessão multiempresa válida." },
      { status: 409 },
    )
  }

  if (!canManageFinance(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar a DRE gerencial." },
      { status: 403 },
    )
  }

  const url = new URL(request.url)
  const defaults = defaultPeriod()
  const start = url.searchParams.get("start") || defaults.start
  const end = url.searchParams.get("end") || defaults.end

  if (!datePattern.test(start) || !datePattern.test(end)) {
    return NextResponse.json(
      { error: "Período inválido. Use datas no formato AAAA-MM-DD." },
      { status: 400 },
    )
  }

  const days = dateDiffDays(start, end)
  if (days <= 0) {
    return NextResponse.json(
      { error: "A data inicial não pode ser posterior à data final." },
      { status: 400 },
    )
  }
  if (days > 400) {
    return NextResponse.json(
      { error: "Selecione um período de no máximo 400 dias." },
      { status: 400 },
    )
  }

  try {
    const report = await getTenantDreReport(session.organizationId, start, end)
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao calcular a DRE.",
      },
      { status: 500 },
    )
  }
}
