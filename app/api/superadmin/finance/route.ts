import { NextResponse } from "next/server"
import { canManagePlatformFinance, getSuperadminAccess } from "@/lib/superadmin-auth"
import {
  createPlatformFinanceEntry,
  getPlatformFinanceSnapshot,
  setPlatformFinanceEntryStatus,
} from "@/lib/platform-finance"
import { requestIp, superadminRequestIsSameOrigin } from "@/lib/superadmin-request"
import {
  finiteNumber,
  InputValidationError,
  oneOf,
  optionalDate,
  optionalMonth,
  optionalText,
  readJsonObject,
  requiredText,
  strictDate,
  validationErrorStatus,
} from "@/lib/security/input-validation"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })

  try {
    const month = optionalMonth(new URL(request.url).searchParams.get("month"))
    return NextResponse.json({ ok: true, data: await getPlatformFinanceSnapshot(month) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Período inválido." },
      { status: validationErrorStatus(error) },
    )
  }
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
    const body = await readJsonObject(request, 32 * 1024)
    if (!body) throw new InputValidationError("Corpo da requisição obrigatório.")

    const action = requiredText(body.action, "Ação", {
      maxLength: 64,
      allowNewlines: false,
    })
    const ip = requestIp(request)

    if (action === "create-entry") {
      const entryType = oneOf(
        body.entryType,
        "Tipo de lançamento",
        ["revenue", "expense"] as const,
      )
      const status = body.status === undefined
        ? "planned"
        : oneOf(body.status, "Status", ["planned", "paid"] as const)

      await createPlatformFinanceEntry(access, {
        competenceDate: strictDate(body.competenceDate, "Data de competência"),
        entryType,
        category: requiredText(body.category, "Categoria", { maxLength: 100 }),
        description: requiredText(body.description, "Descrição", { maxLength: 300 }),
        counterparty: optionalText(body.counterparty, "Contraparte", { maxLength: 180 }) || "",
        amountCents: finiteNumber(body.amountCents, "Valor", {
          min: 1,
          max: 100_000_000_000_000,
          integer: true,
        }),
        status,
        dueDate: optionalDate(body.dueDate, "Vencimento"),
        notes: optionalText(body.notes, "Observações", { maxLength: 2_000 }) || "",
      }, ip)
    } else if (action === "set-status") {
      const status = oneOf(
        body.status,
        "Status",
        ["planned", "paid", "canceled"] as const,
      )
      const entryId = requiredText(body.entryId, "Lançamento", {
        maxLength: 128,
        allowNewlines: false,
      })

      await setPlatformFinanceEntryStatus(access, entryId, status, ip)
    } else {
      return NextResponse.json({ error: "Ação não suportada." }, { status: 400 })
    }

    const month = optionalMonth(body.month)
    return NextResponse.json({ ok: true, data: await getPlatformFinanceSnapshot(month) })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar ação financeira.",
      },
      { status: validationErrorStatus(error) },
    )
  }
}
