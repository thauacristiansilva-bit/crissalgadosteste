import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createTenantFinancialEntry,
  getTenantFinancialEntries,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import {
  canManageFinance,
  canViewFinance,
} from "@/lib/tenant-permissions"
import {
  assertOrganizationEntitlement,
  billingErrorStatus,
} from "@/lib/billing-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

function parseAmount(value: unknown) {
  if (typeof value === "number") return value

  const raw = String(value ?? "")
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s+/g, "")

  if (!raw) return Number.NaN

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw

  return Number(normalized)
}

function internalErrorStatus(error: unknown) {
  const billingStatus = billingErrorStatus(error)
  return billingStatus === 400 ? 500 : billingStatus
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessão da empresa inválida. Entre novamente para acessar o financeiro.",
      },
      { status: 401 },
    )
  }

  if (!canViewFinance(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode acessar o financeiro.",
      },
      { status: 403 },
    )
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        if (!(await isTenantOperationsReady(session.organizationId))) {
          return NextResponse.json(
            {
              error:
                "O financeiro PostgreSQL desta empresa ainda não está preparado. Não foi usado fallback para store.json.",
            },
            { status: 503 },
          )
        }

        await assertOrganizationEntitlement(
          session.organizationId,
          "financial",
        )

        return NextResponse.json({
          entries: await getTenantFinancialEntries(
            session.organizationId,
          ),
        })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o financeiro.",
      },
      { status: internalErrorStatus(error) },
    )
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessão da empresa inválida. Entre novamente antes de criar um lançamento.",
      },
      { status: 401 },
    )
  }

  if (!canManageFinance(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode criar lançamentos financeiros.",
      },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body || (body.type !== "expense" && body.type !== "income")) {
    return NextResponse.json(
      { error: "Tipo de lançamento inválido." },
      { status: 400 },
    )
  }

  const description = String(body.description ?? "").trim()
  const category = String(body.category ?? "Geral").trim() || "Geral"
  const amount = parseAmount(body.amount)

  if (!description) {
    return NextResponse.json(
      { error: "Informe a descrição do lançamento." },
      { status: 400 },
    )
  }

  if (description.length > 500) {
    return NextResponse.json(
      { error: "A descrição deve ter no máximo 500 caracteres." },
      { status: 400 },
    )
  }

  if (category.length > 120) {
    return NextResponse.json(
      { error: "A categoria deve ter no máximo 120 caracteres." },
      { status: 400 },
    )
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Informe um valor maior que zero." },
      { status: 400 },
    )
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        if (!(await isTenantOperationsReady(session.organizationId))) {
          return NextResponse.json(
            {
              error:
                "O financeiro PostgreSQL desta empresa ainda não está preparado. O lançamento não foi enviado ao legado.",
            },
            { status: 503 },
          )
        }

        await assertOrganizationEntitlement(
          session.organizationId,
          "financial",
        )

        const entry = await createTenantFinancialEntry(
          session.organizationId,
          {
            type: body.type as "income" | "expense",
            category,
            description,
            amount,
          },
        )

        return NextResponse.json(
          { entry },
          { status: 201 },
        )
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro no lançamento financeiro.",
      },
      { status: internalErrorStatus(error) },
    )
  }
}
