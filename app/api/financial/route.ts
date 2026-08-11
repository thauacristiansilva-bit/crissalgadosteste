import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createFinancialEntry as createLegacyFinancialEntry,
  getFinancialEntries as getLegacyFinancialEntries,
  syncLegacyFinancialEntryFromTenant,
} from "@/lib/db"
import {
  createTenantFinancialEntry,
  getTenantFinancialEntries,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageFinance,
} from "@/lib/tenant-permissions"

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
    if (!canManageFinance(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode acessar o financeiro.",
        },
        { status: 403 },
      )
    }

    return NextResponse.json({
      entries: await getTenantFinancialEntries(
        session.organizationId,
      ),
    })
  }

  return NextResponse.json({
    entries: await getLegacyFinancialEntries(),
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
    | Record<string, unknown>
    | null

  const input = {
    type:
      body?.type === "expense"
        ? ("expense" as const)
        : ("income" as const),
    category: String(body?.category || "Geral"),
    description: String(body?.description || ""),
    amount: Number(body?.amount || 0),
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const entry =
        await createLegacyFinancialEntry(input)

      return NextResponse.json(
        { entry },
        { status: 201 },
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

    const entry = await createTenantFinancialEntry(
      session.organizationId,
      input,
    )

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyFinancialEntryFromTenant(entry)
    }

    return NextResponse.json(
      { entry },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro no lançamento.",
      },
      { status: 400 },
    )
  }
}
