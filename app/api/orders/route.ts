import { NextResponse } from "next/server"
import {
  isAdminAuthenticated,
} from "@/lib/auth"
import {
  getCurrentCustomerAccount,
} from "@/lib/client-auth"
import {
  getTenantOrders,
  isTenantOrdersReady,
} from "@/lib/order-db"
import {
  createTenantCheckoutOrder,
} from "@/lib/tenant-checkout"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import type {
  Order,
} from "@/lib/types"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import { canReadOrders } from "@/lib/admin-access"
import { getCourierWorkspaceSnapshot } from "@/lib/delivery-dispatch-db"
import { assertActiveSubscriptionForOrganization, assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export async function GET() {
  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      {
        error:
          "Não autorizado.",
      },
      { status: 401 },
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (session) {
    if (!canReadOrders(session.role, session.operationalPermissions)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode visualizar pedidos.",
        },
        { status: 403 },
      )
    }

    const ready =
      await isTenantOrdersReady(
        session.organizationId,
      ).catch(() => false)

    if (ready) {
      if (session.role === "courier") {
        const dispatch = await getCourierWorkspaceSnapshot({
          organizationId: session.organizationId,
          userId: session.userId,
          role: session.role,
          permissions: session.operationalPermissions,
        })
        return NextResponse.json({ orders: dispatch.orders })
      }

      return NextResponse.json({
        orders:
          await getTenantOrders(
            session.organizationId,
          ),
      })
    }

    return NextResponse.json(
      {
        error:
          "Pedidos PostgreSQL desta empresa não estão disponíveis.",
      },
      { status: 503 },
    )
  }

  return NextResponse.json(
    { error: "Sessão tenant obrigatória." },
    { status: 401 },
  )
}

export async function POST(
  request: Request,
) {
  const publicOrganization =
    await resolvePublicOrganizationForRequest(
      request,
    )

  if (!publicOrganization) {
    return NextResponse.json(
      {
        error:
          "Empresa não identificada. Abra a loja pelo link /loja/{slug}.",
      },
      { status: 404 },
    )
  }

  if (!publicOrganization.publicOrderingEnabled) {
    return NextResponse.json(
      {
        error:
          "Pedidos online ainda não foram habilitados para esta empresa.",
      },
      { status: 503 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        type?: Order["type"]
        paymentMethod?:
          Order["paymentMethod"]
        changeFor?: string
        notes?: string
        customer?: Order["customer"]
        items?: Array<{
          productId: number
          quantity: number
          modifierOptionIds?: number[]
        }>
        requestedFor?: string
        timing?:
          | "now"
          | "scheduled"
        couponCode?: string
      }
    | null

  if (
    !body ||
    !body.customer ||
    !Array.isArray(body.items) ||
    !body.items.length
  ) {
    return NextResponse.json(
      {
        error:
          "Pedido incompleto.",
      },
      { status: 400 },
    )
  }

  const timing =
    body.timing === "now"
      ? "now"
      : "scheduled"

  if (
    timing === "scheduled" &&
    !body.requestedFor
  ) {
    return NextResponse.json(
      {
        error:
          "Escolha o dia e o horário do agendamento.",
      },
      { status: 400 },
    )
  }

  if (
    !body.customer.name?.trim() ||
    !body.customer.phone?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Nome e telefone são obrigatórios.",
      },
      { status: 400 },
    )
  }

  const type =
    body.type === "delivery"
      ? "delivery"
      : "pickup"

  if (
    type === "delivery" &&
    (!body.customer.address?.trim() ||
      !body.customer.number?.trim())
  ) {
    return NextResponse.json(
      {
        error:
          "Endereço e número são obrigatórios para delivery.",
      },
      { status: 400 },
    )
  }

  const paymentMethod = [
    "card",
    "cash",
    "pix",
  ].includes(
    String(body.paymentMethod),
  )
    ? (body.paymentMethod as Order["paymentMethod"])
    : "pix"

  const account =
    await getCurrentCustomerAccount()

  try {
    await assertActiveSubscriptionForOrganization(publicOrganization.id)
    if (type === "delivery") {
      await assertOrganizationEntitlement(publicOrganization.id, "delivery")
    }
    if (body.items.some((item) => Array.isArray(item.modifierOptionIds) && item.modifierOptionIds.length > 0)) {
      await assertOrganizationEntitlement(publicOrganization.id, "modifiers")
    }

    const result =
      await createTenantCheckoutOrder(
        publicOrganization.id,
        {
          type,
          paymentMethod,
          changeFor:
            body.changeFor,
          notes: body.notes,
          customer: {
            ...body.customer,
          },
          items: body.items,
          requestedFor:
            body.requestedFor,
          timing,
          couponCode:
            body.couponCode,
          ...(account &&
          account.id
            ? {
                accountId:
                  account.id,
              }
            : {}),
        },
      )


    return NextResponse.json(
      {
        order: result.order,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o pedido.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
