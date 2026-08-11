import { NextResponse } from "next/server"
import {
  isAdminAuthenticated,
} from "@/lib/auth"
import {
  getCurrentCustomerAccount,
} from "@/lib/client-auth"
import {
  createOrder,
  getOrders as getLegacyOrders,
  syncLegacyCustomerAccountFromTenant,
  syncLegacyOrderFromTenant,
  syncLegacyProductFromTenant,
} from "@/lib/db"
import {
  getTenantCustomerAccount,
} from "@/lib/customer-db"
import {
  getTenantProducts,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
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
    const ready =
      await isTenantOrdersReady(
        session.organizationId,
      ).catch(() => false)

    if (ready) {
      return NextResponse.json({
        orders:
          await getTenantOrders(
            session.organizationId,
          ),
      })
    }

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

  return NextResponse.json({
    orders:
      await getLegacyOrders(),
  })
}

async function mirrorCurrentDeploymentCheckout(
  organizationId: string,
  result: Awaited<
    ReturnType<
      typeof createTenantCheckoutOrder
    >
  >,
) {
  if (
    !(await isCurrentDeploymentOrganization(
      organizationId,
    ))
  ) {
    return
  }

  try {
    await syncLegacyOrderFromTenant(
      result.order,
    )

    const changed = new Set(
      result.changedProductIds,
    )

    const products =
      await getTenantProducts(
        organizationId,
        {
          includeInactive: true,
        },
      )

    for (const product of products) {
      if (changed.has(product.id)) {
        await syncLegacyProductFromTenant(
          product,
        )
      }
    }

    if (result.accountId) {
      const account =
        await getTenantCustomerAccount(
          organizationId,
          result.accountId,
        )

      if (account) {
        await syncLegacyCustomerAccountFromTenant(
          account,
        )
      }
    }
  } catch (error) {
    // O pedido PostgreSQL já foi confirmado.
    // Nunca devolvemos falha de espelho para evitar pedido duplicado.
    console.error(
      "[SaborFlow] Checkout PostgreSQL concluído, mas o espelho legado falhou:",
      error instanceof Error
        ? error.message
        : error,
    )
  }
}

export async function POST(
  request: Request,
) {
  const publicOrganization =
    await resolvePublicOrganizationForRequest(
      request,
    )

  if (
    publicOrganization &&
    !publicOrganization.publicOrderingEnabled
  ) {
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
    if (publicOrganization) {
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

      await mirrorCurrentDeploymentCheckout(
        publicOrganization.id,
        result,
      )

      return NextResponse.json(
        {
          order: result.order,
        },
        { status: 201 },
      )
    }

    // Fallback apenas para transição de instalação ainda sem organização.
    const order =
      await createOrder({
        type,
        paymentMethod,
        changeFor:
          body.changeFor,
        notes: body.notes,
        customer: {
          ...body.customer,
          ...(account
            ? {
                accountId:
                  account.id,
              }
            : {}),
        },
        items: body.items,
        requestedFor:
          body.requestedFor,
        timing,
        couponCode:
          body.couponCode,
      })

    return NextResponse.json(
      { order },
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
      { status: 400 },
    )
  }
}
