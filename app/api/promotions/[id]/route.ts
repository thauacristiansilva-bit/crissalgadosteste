import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  updateTenantProductPromotion,
  type ProductPromotionInput,
} from "@/lib/promotions-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"

export const dynamic = "force-dynamic"

function patchFromBody(
  body: Record<string, unknown>,
): Partial<ProductPromotionInput> {
  const patch: Partial<ProductPromotionInput> = {}

  if (body.productId !== undefined) {
    patch.productId = Math.floor(
      Number(body.productId),
    )
  }

  if (
    body.promotionalPrice !== undefined
  ) {
    patch.promotionalPrice = Number(
      body.promotionalPrice,
    )
  }

  if (body.startDate !== undefined) {
    patch.startDate = body.startDate
      ? String(body.startDate)
      : ""
  }

  if (body.endDate !== undefined) {
    patch.endDate = body.endDate
      ? String(body.endDate)
      : ""
  }

  if (
    Array.isArray(body.daysOfWeek)
  ) {
    patch.daysOfWeek =
      body.daysOfWeek.map(Number)
  }

  if (body.startTime !== undefined) {
    patch.startTime = String(
      body.startTime,
    )
  }

  if (body.endTime !== undefined) {
    patch.endTime = String(
      body.endTime,
    )
  }

  if (
    body.recurringWeekly !== undefined
  ) {
    patch.recurringWeekly =
      Boolean(
        body.recurringWeekly,
      )
  }

  if (body.active !== undefined) {
    patch.active = Boolean(
      body.active,
    )
  }

  if (body.highlight !== undefined) {
    patch.highlight = Boolean(
      body.highlight,
    )
  }

  if (body.label !== undefined) {
    patch.label = String(body.label)
  }

  return patch
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  },
) {
  if (
    !requestIsSameOrigin(request)
  ) {
    return NextResponse.json(
      {
        error:
          "Origem da requisicao nao permitida.",
      },
      { status: 403 },
    )
  }

  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

  try {
    const session =
      await getVerifiedTenantSession()

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Sessao tenant obrigatoria.",
        },
        { status: 401 },
      )
    }

    if (
      !canManageMarketing(
        session.role,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil nao pode gerenciar promocoes.",
        },
        { status: 403 },
      )
    }

    const { id } =
      await context.params

    if (
      !/^[0-9a-f-]{36}$/i.test(id)
    ) {
      return NextResponse.json(
        {
          error:
            "Promocao invalida.",
        },
        { status: 400 },
      )
    }

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | Record<string, unknown>
        | null

    if (!body) {
      throw new Error(
        "Dados da promocao obrigatorios.",
      )
    }

    const promotion =
      await updateTenantProductPromotion(
        session.organizationId,
        id,
        patchFromBody(body),
      )

    if (!promotion) {
      return NextResponse.json(
        {
          error:
            "Promocao nao encontrada.",
        },
        { status: 404 },
      )
    }

    const {
      invalidatePublicStoreCache,
    } = await import(
      "@/lib/public-store-db"
    )

    invalidatePublicStoreCache(
      session.organizationId,
    )

    return NextResponse.json({
      promotion,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a promocao.",
      },
      { status: 400 },
    )
  }
}
