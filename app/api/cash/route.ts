import { NextResponse } from "next/server"
import {
  getAdminEmail,
  getAdminSession,
  isAdminAuthenticated,
} from "@/lib/auth"
import {
  closeCashSession as closeLegacyCashSession,
  getCashSessions as getLegacyCashSessions,
  openCashSession as openLegacyCashSession,
  syncLegacyCashSessionFromTenant,
} from "@/lib/db"
import {
  closeTenantCashSession,
  getTenantCashSessions,
  isTenantOperationsReady,
  openTenantCashSession,
} from "@/lib/operations-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canUseCashRegister,
} from "@/lib/tenant-permissions"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (
    session &&
    (await isTenantOperationsReady(
      session.organizationId,
    ).catch(() => false))
  ) {
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
      await assertOrganizationEntitlement(session.organizationId, "financial")
      return NextResponse.json({
        sessions: await getTenantCashSessions(
          session.organizationId,
        ),
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Caixa indisponível no plano." },
        { status: billingErrorStatus(error) },
      )
    }
  }

  return NextResponse.json({
    sessions: await getLegacyCashSessions(),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: "open" | "close"
        id?: number
        amount?: number
        notes?: string
      }
    | null

  try {
    const tenant = await getVerifiedTenantSession()
    const ready =
      tenant &&
      (await isTenantOperationsReady(
        tenant.organizationId,
      ).catch(() => false))

    if (!tenant || !ready) {
      const adminSession = await getAdminSession()
      const openedBy =
        adminSession?.email || getAdminEmail()

      const session =
        body?.action === "close"
          ? await closeLegacyCashSession(
              Number(body.id),
              Number(body.amount || 0),
              String(body.notes || ""),
            )
          : await openLegacyCashSession(
              openedBy,
              Number(body?.amount || 0),
            )

      return NextResponse.json({ session })
    }

    if (!canUseCashRegister(tenant.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode operar o caixa.",
        },
        { status: 403 },
      )
    }

    await assertOrganizationEntitlement(tenant.organizationId, "financial")

    const session =
      body?.action === "close"
        ? await closeTenantCashSession(
            tenant.organizationId,
            Number(body.id),
            Number(body.amount || 0),
            String(body.notes || ""),
          )
        : await openTenantCashSession(
            tenant.organizationId,
            tenant.email,
            Number(body?.amount || 0),
          )

    if (!session) {
      return NextResponse.json(
        { error: "Caixa não encontrado." },
        { status: 404 },
      )
    }

    if (
      await isCurrentDeploymentOrganization(
        tenant.organizationId,
      )
    ) {
      await syncLegacyCashSessionFromTenant(session)
    }

    return NextResponse.json({ session })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro no caixa.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
