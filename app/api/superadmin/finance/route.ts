import { NextResponse } from "next/server"
import { canManagePlatformFinance, getSuperadminAccess } from "@/lib/superadmin-auth"
import {
  createPlatformFinanceEntry,
  getPlatformFinanceSnapshot,
  setPlatformFinanceEntryStatus,
} from "@/lib/platform-finance"
import { requestIp, superadminRequestIsSameOrigin } from "@/lib/superadmin-request"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  const month = new URL(request.url).searchParams.get("month")
  return NextResponse.json({ ok: true, data: await getPlatformFinanceSnapshot(month) })
}

export async function POST(request: Request) {
  if (!superadminRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  if (!canManagePlatformFinance(access.role)) {
    return NextResponse.json({ error: "Sem permissão para gerenciar o financeiro da plataforma." }, { status: 403 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action || "")
    const ip = requestIp(request)

    if (action === "create-entry") {
      const entryType = String(body.entryType || "")
      if (entryType !== "revenue" && entryType !== "expense") throw new Error("Tipo de lançamento inválido.")
      const status = String(body.status || "planned")
      if (status !== "planned" && status !== "paid") throw new Error("Status inicial inválido.")
      await createPlatformFinanceEntry(access, {
        competenceDate: String(body.competenceDate || ""),
        entryType,
        category: String(body.category || ""),
        description: String(body.description || ""),
        counterparty: String(body.counterparty || ""),
        amountCents: Number(body.amountCents),
        status,
        dueDate: body.dueDate ? String(body.dueDate) : null,
        notes: String(body.notes || ""),
      }, ip)
    } else if (action === "set-status") {
      const status = String(body.status || "")
      if (!(["planned", "paid", "canceled"] as const).includes(status as "planned" | "paid" | "canceled")) {
        throw new Error("Status inválido.")
      }
      await setPlatformFinanceEntryStatus(
        access,
        String(body.entryId || ""),
        status as "planned" | "paid" | "canceled",
        ip,
      )
    } else {
      return NextResponse.json({ error: "Ação não suportada." }, { status: 400 })
    }

    const month = body.month ? String(body.month) : null
    return NextResponse.json({ ok: true, data: await getPlatformFinanceSnapshot(month) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao executar ação financeira." }, { status: 400 })
  }
}
