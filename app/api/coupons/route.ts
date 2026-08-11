import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createCoupon as createLegacyCoupon,
  getCoupons as getLegacyCoupons,
  syncLegacyCouponFromTenant,
  validateCoupon as validateLegacyCoupon,
} from "@/lib/db"
import {
  createTenantCoupon,
  getTenantCoupons,
  isTenantOperationsReady,
  validateTenantCoupon,
} from "@/lib/operations-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageMarketing,
} from "@/lib/tenant-permissions"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const subtotal = Number(
    url.searchParams.get("subtotal") || 0,
  )

  if (code) {
    try {
      const publicOrganization =
        await resolvePublicOrganizationForRequest(
          request,
        )

      const postgresResult =
        publicOrganization &&
        (await isTenantOperationsReady(
          publicOrganization.id,
        ).catch(() => false))
          ? await validateTenantCoupon(
              publicOrganization.id,
              code,
              subtotal,
            )
          : null

      const canFallbackLegacy =
        !publicOrganization ||
        (await isCurrentDeploymentOrganization(
          publicOrganization.id,
        ))

      const result =
        postgresResult ||
        (canFallbackLegacy
          ? await validateLegacyCoupon(
              code,
              subtotal,
            )
          : null)

      if (!result) {
        throw new Error(
          "Cupons ainda não foram habilitados para esta empresa.",
        )
      }

      return NextResponse.json({
        valid: true,
        discount: result.discount,
        coupon: result.coupon,
      })
    } catch (error) {
      return NextResponse.json(
        {
          valid: false,
          error:
            error instanceof Error
              ? error.message
              : "Cupom inválido.",
        },
        { status: 400 },
      )
    }
  }

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (
    session &&
    (await isTenantOperationsReady(
      session.organizationId,
    ).catch(() => false))
  ) {
    return NextResponse.json({
      coupons: await getTenantCoupons(
        session.organizationId,
        { includeInactive: true },
      ),
    })
  }

  return NextResponse.json({
    coupons: await getLegacyCoupons({
      includeInactive: true,
    }),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  const input = {
    code: String(body?.code || ""),
    description: String(body?.description || ""),
    type:
      body?.type === "fixed"
        ? ("fixed" as const)
        : ("percent" as const),
    value: Number(body?.value || 0),
    minimumOrder: Number(body?.minimumOrder || 0),
    active: body?.active !== false,
    ...(body?.expiresAt
      ? { expiresAt: String(body.expiresAt) }
      : {}),
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const coupon = await createLegacyCoupon(input)
      return NextResponse.json(
        { coupon },
        { status: 201 },
      )
    }

    if (!canManageMarketing(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar cupons.",
        },
        { status: 403 },
      )
    }

    const coupon = await createTenantCoupon(
      session.organizationId,
      input,
    )

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyCouponFromTenant(coupon)
    }

    return NextResponse.json(
      { coupon },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar cupom.",
      },
      { status: 400 },
    )
  }
}
