import { NextResponse } from "next/server"
import {
  getTenantOrderById,
  isTenantOrdersReady,
  updateTenantOrder,
} from "@/lib/order-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import type { OrderStatus, PaymentStatus } from "@/lib/types"
import { getTenantCourier, isTenantOperationsReady } from "@/lib/operations-db"
import {
  canAssignCourier,
  canUpdateOrderStatus,
  canUpdatePaymentStatus,
} from "@/lib/admin-access"
import { getCourierIdentityForOrderOperation } from "@/lib/delivery-dispatch-db"
import {
  claimCourierActiveOrder,
  releaseCourierActiveOrder,
} from "@/lib/delivery-tracking-db"

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
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as
    | {
        status?: OrderStatus
        paymentStatus?: PaymentStatus
        courierId?: number
      }
    | null

  if (!Number.isInteger(numericId) || !body) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const hasSupportedMutation =
    body.status !== undefined ||
    body.paymentStatus !== undefined ||
    body.courierId !== undefined

  if (!hasSupportedMutation) {
    return NextResponse.json(
      { error: "Nenhuma alteração suportada foi informada." },
      { status: 400 },
    )
  }

  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 })
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

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      const ready = await isTenantOrdersReady(session.organizationId).catch(
        () => false,
      )

      if (!ready) {
        return NextResponse.json(
          { error: "Pedidos PostgreSQL desta empresa não estão disponíveis." },
          { status: 503 },
        )
      }

      const currentOrder = await getTenantOrderById(
        session.organizationId,
        numericId,
      )

      if (!currentOrder) {
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
      }

      if (
        body.status &&
        !canUpdateOrderStatus(session.role, session.operationalPermissions)
      ) {
        return NextResponse.json(
          { error: "Seu perfil não pode alterar o status do pedido." },
          { status: 403 },
        )
      }

      if (
        body.paymentStatus &&
        !canUpdatePaymentStatus(session.role, session.operationalPermissions)
      ) {
        return NextResponse.json(
          { error: "Seu perfil não pode alterar o pagamento." },
          { status: 403 },
        )
      }

      if (
        body.courierId !== undefined &&
        !canAssignCourier(session.role, session.operationalPermissions)
      ) {
        return NextResponse.json(
          { error: "Seu perfil não pode atribuir entregadores." },
          { status: 403 },
        )
      }

      if (session.role === "cashier" && body.status) {
        const validCashierTransition =
          (currentOrder.status === "pending" && body.status === "accepted") ||
          (currentOrder.status !== "completed" &&
            currentOrder.status !== "cancelled" &&
            body.status === "cancelled") ||
          (currentOrder.type === "pickup" &&
            currentOrder.status === "ready" &&
            body.status === "completed")

        if (!validCashierTransition) {
          return NextResponse.json(
            {
              error:
                "O caixa só pode aceitar pedidos, cancelar pedidos ativos ou concluir uma retirada pronta.",
            },
            { status: 403 },
          )
        }
      }

      if (session.role === "kitchen" && body.status) {
        const validKitchenTransition =
          (currentOrder.status === "pending" && body.status === "accepted") ||
          (currentOrder.status === "accepted" && body.status === "preparing") ||
          (currentOrder.status === "preparing" && body.status === "ready")

        if (!validKitchenTransition) {
          return NextResponse.json(
            {
              error:
                "A cozinha só pode avançar o pedido de pendente para aceito, preparando e pronto.",
            },
            { status: 403 },
          )
        }
      }

      if (session.role === "courier" && body.status) {
        if (body.status === "cancelled") {
          return NextResponse.json(
            {
              error:
                "Sua sessão atual é de entregador. O cancelamento deve ser feito no Admin ou Caixa por uma conta autorizada. Pedidos agendados podem ser cancelados normalmente por uma sessão de gestão.",
              code: "COURIER_CANNOT_CANCEL_ORDER",
              workspace: "/entregador",
            },
            { status: 403 },
          )
        }

        try {
          await getCourierIdentityForOrderOperation({
            organizationId: session.organizationId,
            userId: session.userId,
            role: session.role,
            order: currentOrder,
          })
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Este pedido não está atribuído ao seu perfil de entregador.",
            },
            { status: 403 },
          )
        }

        const validTransition =
          (currentOrder.status === "ready" && body.status === "in-route") ||
          (currentOrder.status === "in-route" && body.status === "completed")

        if (!validTransition) {
          return NextResponse.json(
            {
              error:
                "Sua sessão atual é de entregador. No app do entregador, o pedido só pode avançar de pronto para em rota e depois para concluído. Para aceitar, preparar ou cancelar, use uma sessão de gestão no Admin/Caixa.",
              code: "COURIER_STATUS_TRANSITION_RESTRICTED",
              workspace: "/entregador",
            },
            { status: 403 },
          )
        }
      }

      if (
        currentOrder.type === "delivery" &&
        currentOrder.status === "in-route" &&
        body.courierId !== undefined &&
        Number(body.courierId) !== Number(currentOrder.courierId)
      ) {
        return NextResponse.json(
          {
            error:
              "Uma entrega em rota não pode trocar de entregador. Conclua ou cancele a entrega antes de reatribuir.",
          },
          { status: 409 },
        )
      }

      let courierPatch:
        | { courierId?: number; courierName?: string }
        | undefined

      if (body.courierId !== undefined) {
        const operationsReady = await isTenantOperationsReady(
          session.organizationId,
        ).catch(() => false)

        if (!operationsReady) {
          return NextResponse.json(
            { error: "Entregadores PostgreSQL desta empresa não estão disponíveis." },
            { status: 503 },
          )
        }

        const courierId = Number(body.courierId)
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
      }

      const targetCourierId =
        courierPatch?.courierId ?? currentOrder.courierId

      if (
        body.status === "in-route" &&
        currentOrder.type === "delivery" &&
        !targetCourierId
      ) {
        return NextResponse.json(
          { error: "Atribua um entregador antes de iniciar a rota." },
          { status: 409 },
        )
      }

      if (
        body.status === "in-route" &&
        currentOrder.type === "delivery" &&
        !["ready", "in-route"].includes(currentOrder.status)
      ) {
        return NextResponse.json(
          { error: "A entrega precisa estar pronta antes de iniciar a rota." },
          { status: 409 },
        )
      }

      let claimedCourierId: number | null = null

      try {
        if (
          body.status === "in-route" &&
          currentOrder.type === "delivery" &&
          currentOrder.status !== "in-route" &&
          targetCourierId
        ) {
          await claimCourierActiveOrder({
            organizationId: session.organizationId,
            courierId: targetCourierId,
            orderId: currentOrder.id,
          })
          claimedCourierId = targetCourierId
        }

        const patch = {
          ...(body.status ? { status: body.status } : {}),
          ...(body.paymentStatus
            ? { paymentStatus: body.paymentStatus }
            : {}),
          ...(courierPatch || {}),
        }

        const order = await updateTenantOrder(
          session.organizationId,
          numericId,
          patch,
        )

        if (!order) {
          if (claimedCourierId) {
            await releaseCourierActiveOrder({
              organizationId: session.organizationId,
              courierId: claimedCourierId,
              orderId: currentOrder.id,
            })
          }
          return NextResponse.json(
            { error: "Pedido não encontrado." },
            { status: 404 },
          )
        }

        if (
          currentOrder.type === "delivery" &&
          currentOrder.courierId &&
          currentOrder.status === "in-route" &&
          body.status !== undefined &&
          body.status !== "in-route"
        ) {
          await releaseCourierActiveOrder({
            organizationId: session.organizationId,
            courierId: currentOrder.courierId,
            orderId: currentOrder.id,
          })
        }

        return NextResponse.json({ order })
      } catch (error) {
        if (claimedCourierId) {
          await releaseCourierActiveOrder({
            organizationId: session.organizationId,
            courierId: claimedCourierId,
            orderId: currentOrder.id,
          }).catch(() => null)
        }

        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível atualizar o pedido.",
          },
          { status: 409 },
        )
      }
    },
    "tenant-session",
  )
}
