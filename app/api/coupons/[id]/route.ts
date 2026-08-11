import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  syncLegacyCouponFromTenant,
  updateCoupon as updateLegacyCoupon,
} from "@/lib/db"
import {
  isTenantOperationsReady,
  updateTenantCoupon,
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
    | Record<string, unknown>
    | null

  if (!Number.isInteger(numericId) || !body) {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 },
    )
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantOperationsReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const coupon = await updateLegacyCoupon(
        numericId,
        body,
      )

      return coupon
        ? NextResponse.json({ coupon })
        : NextResponse.json(
            { error: "Cupom não encontrado." },
            { status: 404 },
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

    const coupon = await updateTenantCoupon(
      session.organizationId,
      numericId,
      body,
    )

    if (!coupon) {
      return NextResponse.json(
        { error: "Cupom não encontrado." },
        { status: 404 },
      )
    }

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyCouponFromTenant(coupon)
    }

    return NextResponse.json({ coupon })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o cupom.",
      },
      { status: 400 },
    )
  }
}
