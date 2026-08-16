import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createCourier as createLegacyCourier,
  getCouriers as getLegacyCouriers,
  syncLegacyCourierFromTenant,
} from "@/lib/db"
import {
  createTenantCourier,
  getTenantCouriers,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageDeliveryOperation,
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
    if (!canManageDeliveryOperation(session.role)) {
      return NextResponse.json(
        { error: "Seu perfil não pode acessar entregadores." },
        { status: 403 },
      )
    }
    return NextResponse.json({
      couriers: await getTenantCouriers(
        session.organizationId,
        { includeInactive: true },
      ),
    })
  }

  return NextResponse.json({
    couriers: await getLegacyCouriers({
      includeInactive: true,
    }),
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

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const input = {
    name: String(body.name || ""),
    phone: String(body.phone || ""),
    vehicle: String(body.vehicle || ""),
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const courier =
        await createLegacyCourier(input)

      return NextResponse.json(
        { courier },
        { status: 201 },
      )
    }

    if (!canManageDeliveryOperation(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar entregadores.",
        },
        { status: 403 },
      )
    }

    const courier = await createTenantCourier(
      session.organizationId,
      input,
    )

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyCourierFromTenant(courier)
    }

    return NextResponse.json(
      { courier },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar o entregador.",
      },
      { status: 400 },
    )
  }
}
