import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  deleteCourier as deleteLegacyCourier,
  syncLegacyCourierFromTenant,
  updateCourier as updateLegacyCourier,
} from "@/lib/db"
import {
  deactivateTenantCourier,
  isTenantOperationsReady,
  updateTenantCourier,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!Number.isInteger(numericId) || !body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const patch = {
    ...(body.name !== undefined
      ? { name: String(body.name) }
      : {}),
    ...(body.phone !== undefined
      ? { phone: String(body.phone) }
      : {}),
    ...(body.vehicle !== undefined
      ? { vehicle: String(body.vehicle) }
      : {}),
    ...(body.active !== undefined
      ? { active: Boolean(body.active) }
      : {}),
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const courier = await updateLegacyCourier(
        numericId,
        patch,
      )

      return courier
        ? NextResponse.json({ courier })
        : NextResponse.json(
            { error: "Entregador não encontrado." },
            { status: 404 },
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

    const courier = await updateTenantCourier(
      session.organizationId,
      numericId,
      patch,
    )

    if (!courier) {
      return NextResponse.json(
        { error: "Entregador não encontrado." },
        { status: 404 },
      )
    }

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyCourierFromTenant(courier)
    }

    return NextResponse.json({ courier })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o entregador.",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)
  const session = await getVerifiedTenantSession()

  const ready =
    session &&
    (await isTenantOperationsReady(
      session.organizationId,
    ).catch(() => false))

  if (!session || !ready) {
    const courier = await deleteLegacyCourier(
      numericId,
    )

    return courier
      ? NextResponse.json({ ok: true })
      : NextResponse.json(
          { error: "Entregador não encontrado." },
          { status: 404 },
        )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode desativar entregadores.",
      },
      { status: 403 },
    )
  }

  const courier = await deactivateTenantCourier(
    session.organizationId,
    numericId,
  )

  if (!courier) {
    return NextResponse.json(
      { error: "Entregador não encontrado." },
      { status: 404 },
    )
  }

  if (
    await isCurrentDeploymentOrganization(
      session.organizationId,
    )
  ) {
    await syncLegacyCourierFromTenant(courier)
  }

  return NextResponse.json({ ok: true })
}
