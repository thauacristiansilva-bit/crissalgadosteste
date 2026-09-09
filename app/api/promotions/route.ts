import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getTenantProducts } from "@/lib/catalog-db"
import {
  createTenantProductPromotion,
  getTenantProductPromotions,
  isProductPromotionsReady,
  type ProductPromotionInput,
} from "@/lib/promotions-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"

export const dynamic = "force-dynamic"

function inputFromBody(
  body: Record<string, unknown>,
): ProductPromotionInput {
  return {
    productId: Math.floor(
      Number(body.productId),
    ),
    promotionalPrice: Number(
      body.promotionalPrice,
    ),
    startDate:
      body.startDate
        ? String(body.startDate)
        : undefined,
    endDate:
      body.endDate
        ? String(body.endDate)
        : undefined,
    daysOfWeek:
      Array.isArray(body.daysOfWeek)
        ? body.daysOfWeek.map(Number)
        : [],
    startTime: String(
      body.startTime || "00:00",
    ),
    endTime: String(
      body.endTime || "23:59",
    ),
    recurringWeekly:
      body.recurringWeekly !== false,
    active: body.active !== false,
    highlight: body.highlight !== false,
    label: String(
      body.label || "Oferta",
    ),
  }
}

export async function GET() {
  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

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
          "Seu perfil nao pode visualizar promocoes.",
      },
      { status: 403 },
    )
  }

  const [
    ready,
    promotions,
    products,
  ] = await Promise.all([
    isProductPromotionsReady()
      .catch(() => false),
    getTenantProductPromotions(
      session.organizationId,
      { includeInactive: true },
    ),
    getTenantProducts(
      session.organizationId,
      { includeInactive: true },
    ),
  ])

  return NextResponse.json({
    ready,
    promotions,
    products: products.map(
      (product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        active: product.active,
      }),
    ),
  })
}

export async function POST(
  request: Request,
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
      await createTenantProductPromotion(
        session.organizationId,
        inputFromBody(body),
      )

    if (!promotion) {
      throw new Error(
        "Nao foi possivel carregar a promocao criada.",
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

    return NextResponse.json(
      { promotion },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a promocao.",
      },
      { status: 400 },
    )
  }
}
