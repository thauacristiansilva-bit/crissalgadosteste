import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  deleteDeliveryZone as deleteLegacyDeliveryZone,
  removeLegacyDeliveryZoneMirror,
  syncLegacyDeliveryZoneFromTenant,
  updateDeliveryZone as updateLegacyDeliveryZone,
} from "@/lib/db"
import {
  deleteTenantDeliveryZone,
  isTenantOperationsReady,
  updateTenantDeliveryZone,
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
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

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
      { error: "Requisição inválida." },
      { status: 400 },
    )
  }

  const patch = {
    ...(body.name !== undefined
      ? { name: String(body.name) }
      : {}),
    ...(body.centerLat !== undefined
      ? { centerLat: Number(body.centerLat) }
      : {}),
    ...(body.centerLng !== undefined
      ? { centerLng: Number(body.centerLng) }
      : {}),
    ...(body.radiusMeters !== undefined
      ? { radiusMeters: Number(body.radiusMeters) }
      : {}),
    ...(body.fee !== undefined
      ? { fee: Number(body.fee) }
      : {}),
    ...(body.shape !== undefined
      ? {
          shape:
            body.shape === "polygon"
              ? ("polygon" as const)
              : ("circle" as const),
        }
      : {}),
    ...(Array.isArray(body.points)
      ? {
          points: body.points as Array<{
            lat: number
            lng: number
          }>,
        }
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
      const deliveryZone =
        await updateLegacyDeliveryZone(
          numericId,
          patch,
        )

      return deliveryZone
        ? NextResponse.json({ deliveryZone })
        : NextResponse.json(
            { error: "Área não encontrada." },
            { status: 404 },
          )
    }

    if (!canManageDeliveryOperation(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar áreas de entrega.",
        },
        { status: 403 },
      )
    }

    await assertOrganizationEntitlement(session.organizationId, "delivery")

    const deliveryZone =
      await updateTenantDeliveryZone(
        session.organizationId,
        numericId,
        patch,
      )

    if (!deliveryZone) {
      return NextResponse.json(
        { error: "Área não encontrada." },
        { status: 404 },
      )
    }

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyDeliveryZoneFromTenant(
        deliveryZone,
      )
    }

    return NextResponse.json({ deliveryZone })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a área.",
      },
      { status: billingErrorStatus(error) },
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
    const deleted =
      await deleteLegacyDeliveryZone(numericId)

    return deleted
      ? NextResponse.json({ ok: true })
      : NextResponse.json(
          { error: "Área não encontrada." },
          { status: 404 },
        )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode excluir áreas de entrega.",
      },
      { status: 403 },
    )
  }

  try {
    await assertOrganizationEntitlement(session.organizationId, "delivery")
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delivery indisponível no plano." },
      { status: billingErrorStatus(error) },
    )
  }

  const deleted = await deleteTenantDeliveryZone(
    session.organizationId,
    numericId,
  )

  if (!deleted) {
    return NextResponse.json(
      { error: "Área não encontrada." },
      { status: 404 },
    )
  }

  if (
    await isCurrentDeploymentOrganization(
      session.organizationId,
    )
  ) {
    await removeLegacyDeliveryZoneMirror(numericId)
  }

  return NextResponse.json({ ok: true })
}
