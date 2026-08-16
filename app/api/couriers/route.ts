import { NextResponse } from "next/server"
import {
  createTenantCourier,
  getTenantCouriers,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageDeliveryOperation } from "@/lib/tenant-permissions"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar entregadores." },
      { status: 403 },
    )
  }

  const ready = await isTenantOperationsReady(
    session.organizationId,
  ).catch(() => false)

  if (!ready) {
    return NextResponse.json(
      { error: "Operação PostgreSQL da empresa não está pronta." },
      { status: 503 },
    )
  }

  return NextResponse.json({
    couriers: await getTenantCouriers(
      session.organizationId,
      { includeInactive: true },
    ),
  })
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar entregadores." },
      { status: 403 },
    )
  }

  const ready = await isTenantOperationsReady(
    session.organizationId,
  ).catch(() => false)

  if (!ready) {
    return NextResponse.json(
      { error: "Operação PostgreSQL da empresa não está pronta." },
      { status: 503 },
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

  const rawStaffMemberId = body.staffMemberId
  const staffMemberId =
    rawStaffMemberId === null ||
    rawStaffMemberId === undefined ||
    rawStaffMemberId === ""
      ? null
      : Number(rawStaffMemberId)

  try {
    const courier = await createTenantCourier(
      session.organizationId,
      {
        name: String(body.name || ""),
        phone: String(body.phone || ""),
        vehicle: String(body.vehicle || ""),
        staffMemberId,
      },
    )

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
