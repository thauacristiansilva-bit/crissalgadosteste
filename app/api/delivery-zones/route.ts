import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createTenantDeliveryZone,
  getTenantDeliveryZones,
  isTenantOperationsReady,
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

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "Sessão da empresa inválida. Entre novamente para acessar as áreas de entrega." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar áreas de entrega." },
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
                "As áreas de entrega PostgreSQL desta empresa ainda não estão preparadas. Não foi usado fallback para store.json.",
            },
            { status: 503 },
          )
        }

        await assertOrganizationEntitlement(session.organizationId, "delivery")

        return NextResponse.json({
          deliveryZones: await getTenantDeliveryZones(session.organizationId, {
            includeInactive: true,
          }),
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
            : "Não foi possível carregar as áreas de entrega.",
      },
      { status: deliveryZoneErrorStatus(error) },
    )
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { error: "Sessão da empresa inválida. Entre novamente antes de criar a área de entrega." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar áreas de entrega." },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  const centerLat = parseDecimal(body.centerLat)
  const centerLng = parseDecimal(body.centerLng)
  const radiusMeters = parseDecimal(body.radiusMeters ?? 1500)
  const fee = parseDecimal(body.fee)
  const shape = body.shape === "polygon" ? ("polygon" as const) : ("circle" as const)
  const points = Array.isArray(body.points)
    ? body.points
        .map((point) => {
          const raw = point as Record<string, unknown>
          return { lat: parseDecimal(raw.lat), lng: parseDecimal(raw.lng) }
        })
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    : []

  if (!name) {
    return NextResponse.json({ error: "Informe o nome da área de entrega." }, { status: 400 })
  }

  if (
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng) ||
    !Number.isFinite(radiusMeters) ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    return NextResponse.json({ error: "Dados da área de entrega inválidos." }, { status: 400 })
  }

  if (shape === "polygon" && points.length < 3) {
    return NextResponse.json(
      { error: "Desenhe pelo menos 3 pontos para criar a área personalizada." },
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
                "As áreas de entrega PostgreSQL desta empresa ainda não estão preparadas. A criação não foi enviada ao legado store.json.",
            },
            { status: 503 },
          )
        }

        await assertOrganizationEntitlement(session.organizationId, "delivery")

        const deliveryZone = await createTenantDeliveryZone(session.organizationId, {
          name,
          centerLat,
          centerLng,
          radiusMeters,
          fee,
          shape,
          points,
        })

        return NextResponse.json({ deliveryZone }, { status: 201 })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar a área de entrega.",
      },
      { status: deliveryZoneErrorStatus(error) },
    )
  }
}
