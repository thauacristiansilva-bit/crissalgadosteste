import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  deleteTenantDeliveryZone,
  isTenantOperationsReady,
  updateTenantDeliveryZone,
} from "@/lib/operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageDeliveryOperation } from "@/lib/tenant-permissions"
import {
  assertOrganizationEntitlement,
  billingErrorStatus,
} from "@/lib/billing-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"

function parseDecimal(value: unknown) {
  if (typeof value === "number") return value
  const raw = String(value ?? "").trim().replace(/\s+/g, "")
  if (!raw) return Number.NaN
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw)
}

function deliveryZoneErrorStatus(error: unknown) {
  const billingStatus = billingErrorStatus(error)
  if (billingStatus !== 400) return billingStatus
  if (
    error instanceof Error &&
    /área|polígono|desenho|ponto|taxa|dados/i.test(error.message)
  ) {
    return 400
  }
  return 500
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "Sessão da empresa inválida. Entre novamente antes de alterar a área de entrega." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar áreas de entrega." },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null

  if (!Number.isInteger(numericId) || numericId <= 0 || !body) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const patch = {
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    ...(body.centerLat !== undefined ? { centerLat: parseDecimal(body.centerLat) } : {}),
    ...(body.centerLng !== undefined ? { centerLng: parseDecimal(body.centerLng) } : {}),
    ...(body.radiusMeters !== undefined ? { radiusMeters: parseDecimal(body.radiusMeters) } : {}),
    ...(body.fee !== undefined ? { fee: parseDecimal(body.fee) } : {}),
    ...(body.shape !== undefined
      ? { shape: body.shape === "polygon" ? ("polygon" as const) : ("circle" as const) }
      : {}),
    ...(Array.isArray(body.points)
      ? {
          points: body.points
            .map((point) => {
              const raw = point as Record<string, unknown>
              return { lat: parseDecimal(raw.lat), lng: parseDecimal(raw.lng) }
            })
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
        }
      : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  }

  if ("name" in patch && !patch.name) {
    return NextResponse.json({ error: "Informe o nome da área de entrega." }, { status: 400 })
  }

  for (const key of ["centerLat", "centerLng", "radiusMeters", "fee"] as const) {
    if (key in patch && !Number.isFinite(patch[key])) {
      return NextResponse.json({ error: "Dados da área de entrega inválidos." }, { status: 400 })
    }
  }

  if ("fee" in patch && typeof patch.fee === "number" && patch.fee < 0) {
    return NextResponse.json({ error: "A taxa de entrega não pode ser negativa." }, { status: 400 })
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
                "As áreas de entrega PostgreSQL desta empresa ainda não estão preparadas. A atualização não foi enviada ao legado store.json.",
            },
            { status: 503 },
          )
        }

        await assertOrganizationEntitlement(session.organizationId, "delivery")

        const deliveryZone = await updateTenantDeliveryZone(
          session.organizationId,
          numericId,
          patch,
        )

        return deliveryZone
          ? NextResponse.json({ deliveryZone })
          : NextResponse.json({ error: "Área não encontrada." }, { status: 404 })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a área de entrega.",
      },
      { status: deliveryZoneErrorStatus(error) },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "Sessão da empresa inválida. Entre novamente antes de excluir a área de entrega." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode excluir áreas de entrega." },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Área de entrega inválida." }, { status: 400 })
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
                "As áreas de entrega PostgreSQL desta empresa ainda não estão preparadas. A exclusão não foi enviada ao legado store.json.",
            },
            { status: 503 },
          )
        }

        await assertOrganizationEntitlement(session.organizationId, "delivery")

        const deleted = await deleteTenantDeliveryZone(session.organizationId, numericId)
        return deleted
          ? NextResponse.json({ ok: true })
          : NextResponse.json({ error: "Área não encontrada." }, { status: 404 })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir a área de entrega.",
      },
      { status: deliveryZoneErrorStatus(error) },
    )
  }
}
