import { NextResponse } from "next/server"
import {
  deactivateTenantCourier,
  isTenantOperationsReady,
  updateTenantCourier,
} from "@/lib/operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageDeliveryOperation } from "@/lib/tenant-permissions"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    ...(body.staffMemberId !== undefined
      ? {
          staffMemberId:
            body.staffMemberId === null || body.staffMemberId === ""
              ? null
              : Number(body.staffMemberId),
        }
      : {}),
  }

  try {
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
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageDeliveryOperation(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode desativar entregadores." },
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

  const { id } = await context.params
  const numericId = Number(id)

  if (!Number.isInteger(numericId)) {
    return NextResponse.json(
      { error: "Entregador inválido." },
      { status: 400 },
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

  return NextResponse.json({ ok: true })
}
