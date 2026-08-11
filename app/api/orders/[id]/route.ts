import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  syncLegacyOrderFromTenant,
  updateOrder as updateLegacyOrder,
} from "@/lib/db"
import {
  isTenantOrdersReady,
  updateTenantOrder,
} from "@/lib/order-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import type { OrderStatus, PaymentStatus } from "@/lib/types"

const validStatuses: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "in-route",
  "completed",
  "cancelled",
]

const validPaymentStatuses: PaymentStatus[] = ["paid", "unpaid"]

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
    | {
        status?: OrderStatus
        paymentStatus?: PaymentStatus
        courierId?: number
        courierName?: string
      }
    | null

  if (!Number.isInteger(numericId) || !body) {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 },
    )
  }

  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: "Status inválido." },
      { status: 400 },
    )
  }

  if (
    body.paymentStatus &&
    !validPaymentStatuses.includes(body.paymentStatus)
  ) {
    return NextResponse.json(
      { error: "Status de pagamento inválido." },
      { status: 400 },
    )
  }

  const patch = {
    ...(body.status ? { status: body.status } : {}),
    ...(body.paymentStatus
      ? { paymentStatus: body.paymentStatus }
      : {}),
    ...(body.courierId !== undefined
      ? { courierId: Number(body.courierId) || undefined }
      : {}),
    ...(body.courierName !== undefined
      ? { courierName: body.courierName.trim() }
      : {}),
  }

  const session = await getVerifiedTenantSession()
  const ready =
    session &&
    (await isTenantOrdersReady(session.organizationId).catch(() => false))

  if (!session || !ready) {
    const order = await updateLegacyOrder(numericId, patch)

    if (!order) {
      return NextResponse.json(
        { error: "Pedido não encontrado." },
        { status: 404 },
      )
    }

    return NextResponse.json({ order })
  }

  const order = await updateTenantOrder(
    session.organizationId,
    numericId,
    patch,
  )

  if (!order) {
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    )
  }

  if (await isCurrentDeploymentOrganization(session.organizationId)) {
    await syncLegacyOrderFromTenant(order)
  }

  return NextResponse.json({ order })
}
