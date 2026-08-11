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
        }>
        requestedFor?: string
        timing?:
          | "now"
          | "scheduled"
        notes?: string
        changeFor?: string
        couponCode?: string
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
  }

  try {
    const session =
      await getVerifiedTenantSession()

    if (session) {
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
      { status: 400 },
    )
  }
}
