import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  closeTenantCashSession,
  getTenantCashSessions,
  isTenantOperationsReady,
  openTenantCashSession,
} from "@/lib/operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canUseCashRegister } from "@/lib/tenant-permissions"
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
          "Sessão da empresa inválida. Entre novamente para acessar o caixa.",
      },
      { status: 401 },
    )
  }

  if (!canUseCashRegister(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode acessar o caixa.",
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
                "O caixa PostgreSQL desta empresa ainda não está preparado. Não foi usado fallback para store.json.",
            },
            { status: 503 },
          )
        }

        return NextResponse.json({
          sessions: await getTenantCashSessions(
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
            : "Não foi possível carregar o caixa.",
      },
      { status: 500 },
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
          "Sessão da empresa inválida. Entre novamente antes de operar o caixa.",
      },
      { status: 401 },
    )
  }

  if (!canUseCashRegister(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode operar o caixa.",
      },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body || (body.action !== "open" && body.action !== "close")) {
    return NextResponse.json(
      { error: "Ação de caixa inválida." },
      { status: 400 },
    )
  }

  const amount = parseAmount(body.amount)

  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: "Informe um valor de caixa válido." },
      { status: 400 },
    )
  }

  const id = Number(body.id)
  if (
    body.action === "close" &&
    (!Number.isInteger(id) || id <= 0)
  ) {
    return NextResponse.json(
      { error: "Caixa aberto inválido." },
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
                "O caixa PostgreSQL desta empresa ainda não está preparado. A operação não foi enviada ao legado.",
            },
            { status: 503 },
          )
        }

        const cashSession =
          body.action === "close"
            ? await closeTenantCashSession(
                session.organizationId,
                id,
                amount,
                String(body.notes ?? ""),
              )
            : await openTenantCashSession(
                session.organizationId,
                session.email,
                amount,
              )

        if (!cashSession) {
          return NextResponse.json(
            { error: "Caixa não encontrado." },
            { status: 404 },
          )
        }

        return NextResponse.json({ session: cashSession })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro no caixa.",
      },
      { status: 400 },
    )
  }
}
