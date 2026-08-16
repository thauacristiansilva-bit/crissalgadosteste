import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  syncLegacyOrderFromTenant,
  syncLegacyProductFromTenant,
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
  getTenantProducts,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import type { OrderStatus, PaymentStatus } from "@/lib/types"
import { getTenantCourier, isTenantOperationsReady } from "@/lib/operations-db"
import { canAssignCourier, canUpdateOrderStatus, canUpdatePaymentStatus } from "@/lib/admin-access"

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

  const session = await getVerifiedTenantSession()

  if (session) {
    if (
      body.status &&
      !canUpdateOrderStatus(
        session.role,
        session.operationalPermissions,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar o status do pedido.",
        },
        { status: 403 },
      )
    }

    if (
      body.paymentStatus &&
      !canUpdatePaymentStatus(
        session.role,
        session.operationalPermissions,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar o pagamento.",
        },
        { status: 403 },
      )
    }

    if (
      body.courierId !== undefined &&
      !canAssignCourier(
        session.role,
        session.operationalPermissions,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode atribuir entregadores.",
        },
        { status: 403 },
      )
    }

    if (
      session.role === "kitchen" &&
      body.status &&
      ![
        "accepted",
        "preparing",
        "ready",
      ].includes(body.status)
    ) {
      return NextResponse.json(
        {
          error:
            "A cozinha só pode mover pedidos entre aceito, preparando e pronto.",
        },
        { status: 403 },
      )
    }

    if (
      session.role === "courier" &&
      body.status &&
      ![
        "in-route",
        "completed",
      ].includes(body.status)
    ) {
      return NextResponse.json(
        {
          error:
            "O entregador só pode marcar pedido em rota ou concluído.",
        },
        { status: 403 },
      )
    }
  }

  let courierPatch:
    | { courierId?: number; courierName?: string }
    | undefined

  if (body.courierId !== undefined) {
    const courierId = Number(body.courierId)
    const operationsReady =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (session && operationsReady) {
      if (Number.isInteger(courierId) && courierId > 0) {
        const courier = await getTenantCourier(
          session.organizationId,
          courierId,
        )

        if (!courier || !courier.active) {
          return NextResponse.json(
            { error: "Entregador inválido para esta empresa." },
            { status: 400 },
          )
        }

        courierPatch = {
          courierId: courier.id,
          courierName: courier.name,
        }
      } else {
        courierPatch = {
          courierId: undefined,
          courierName: "",
        }
      }
    } else if (
      session &&
      !(await isCurrentDeploymentOrganization(
        session.organizationId,
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "Entregadores PostgreSQL desta empresa não estão disponíveis.",
        },
        { status: 503 },
      )
    } else {
      courierPatch = {
        courierId:
          Number.isInteger(courierId) && courierId > 0
            ? courierId
            : undefined,
        courierName: body.courierName?.trim() || "",
      }
    }
  }

  const patch = {
    ...(body.status ? { status: body.status } : {}),
    ...(body.paymentStatus
      ? { paymentStatus: body.paymentStatus }
      : {}),
    ...(courierPatch || {}),
  }

  const ready =
    session &&
    (await isTenantOrdersReady(session.organizationId).catch(() => false))

  if (session && !ready) {
    if (
      !(await isCurrentDeploymentOrganization(
        session.organizationId,
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "Pedidos PostgreSQL desta empresa não estão disponíveis.",
        },
        { status: 503 },
      )
    }
  }

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
    if (body.status === "cancelled") {
      const changedProductIds = new Set(order.items.map((item) => item.productId))
      const products = await getTenantProducts(session.organizationId, { includeInactive: true })
      for (const product of products) {
        if (changedProductIds.has(product.id)) {
          await syncLegacyProductFromTenant(product)
        }
      }
    }
  }

  return NextResponse.json({ order })
}
