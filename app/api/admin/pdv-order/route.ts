import { NextResponse } from "next/server"
import {
  isAdminAuthenticated,
} from "@/lib/auth"
import {
  createPdvOrder,
  syncLegacyOrderFromTenant,
  syncLegacyProductFromTenant,
} from "@/lib/db"
import {
  getTenantProducts,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  createTenantCheckoutOrder,
} from "@/lib/tenant-checkout"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import type {
  Order,
} from "@/lib/types"
import { canUsePdv } from "@/lib/admin-access"
import { assertActiveSubscriptionForOrganization, assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"

export async function POST(
  request: Request,
) {
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

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        type?: string
        paymentMethod?: string
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
        notes?: string
        changeFor?: string
        couponCode?: string
        accountId?: number
      }
    | null

  if (
    !body?.items?.length
  ) {
    return NextResponse.json(
      {
        error:
          "Adicione produtos.",
      },
      { status: 400 },
    )
  }

  const input = {
    type:
      body.type === "delivery"
        ? ("delivery" as const)
        : ("pickup" as const),
    paymentMethod: ([
      "pix",
      "cash",
      "card",
    ].includes(
      String(
        body.paymentMethod,
      ),
    )
      ? body.paymentMethod
      : "cash") as Order["paymentMethod"],
    customer:
      body.customer || {
        name: "Balcão",
        phone: "",
        address: "",
      },
    items: body.items,
    requestedFor:
      body.requestedFor ||
      new Date().toISOString(),
    timing:
      body.timing === "scheduled"
        ? ("scheduled" as const)
        : ("now" as const),
    notes: body.notes,
    changeFor:
      body.changeFor,
    couponCode:
      body.couponCode,
    accountId:
      Number.isFinite(Number(body.accountId)) && Number(body.accountId) > 0
        ? Math.floor(Number(body.accountId))
        : undefined,
  }

  if (
    input.type === "delivery" &&
    (!input.customer.name?.trim() || !input.customer.phone?.trim())
  ) {
    return NextResponse.json(
      {
        error:
          "Nome e telefone são obrigatórios para entrega.",
      },
      { status: 400 },
    )
  }

  try {
    const session =
      await getVerifiedTenantSession()

    if (session) {
      if (!canUsePdv(session.role, session.operationalPermissions)) {
        return NextResponse.json(
          {
            error:
              "Seu perfil não pode usar o PDV.",
          },
          { status: 403 },
        )
      }

      await assertActiveSubscriptionForOrganization(session.organizationId)

      if (input.type === "delivery") {
        await assertOrganizationEntitlement(session.organizationId, "delivery")
      }
      if (input.items.some((item) => Array.isArray(item.modifierOptionIds) && item.modifierOptionIds.length > 0)) {
        await assertOrganizationEntitlement(session.organizationId, "modifiers")
      }

      const result =
        await createTenantCheckoutOrder(
          session.organizationId,
          {
            ...input,
            channel: "PDV",
            bypassLeadTime: true,
          },
        )

      if (
        await isCurrentDeploymentOrganization(
          session.organizationId,
        )
      ) {
        try {
          await syncLegacyOrderFromTenant(
            result.order,
          )

          const changed =
            new Set(
              result.changedProductIds,
            )

          const products =
            await getTenantProducts(
              session.organizationId,
              {
                includeInactive:
                  true,
              },
            )

          for (const product of products) {
            if (
              changed.has(
                product.id,
              )
            ) {
              await syncLegacyProductFromTenant(
                product,
              )
            }
          }
        } catch (error) {
          console.error(
            "[SaborFlow] PDV PostgreSQL concluído, mas o espelho legado falhou:",
            error instanceof Error
              ? error.message
              : error,
          )
        }
      }

      return NextResponse.json(
        {
          order: result.order,
        },
        { status: 201 },
      )
    }

    const order =
      await createPdvOrder(
        input,
      )

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
            : "Erro ao criar pedido.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
