import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createTenantCoupon,
  getTenantCoupons,
  isTenantOperationsReady,
  validateTenantCoupon,
} from "@/lib/operations-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageMarketing,
} from "@/lib/tenant-permissions"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  finiteNumber,
  InputValidationError,
  oneOf,
  optionalBoolean,
  optionalIsoDateTime,
  optionalText,
  readJsonObject,
  requiredText,
  validationErrorStatus,
} from "@/lib/security/input-validation"

const COUPON_CODE_OPTIONS = {
  maxLength: 40,
  allowNewlines: false,
  pattern: /^[A-Za-z0-9_-]+$/,
} as const

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawCode = url.searchParams.get("code")

  if (rawCode !== null && rawCode !== "") {
    try {
      const code = requiredText(rawCode, "Código do cupom", COUPON_CODE_OPTIONS)
      const subtotal = finiteNumber(
        url.searchParams.get("subtotal") || 0,
        "Subtotal",
        { min: 0, max: 100_000_000 },
      )

      const organization =
        await resolvePublicOrganizationForRequest(
          request,
        )

      if (!organization) {
        throw new Error("Empresa não identificada.")
      }

      const result = await runWithTenantRlsScope(
        [organization.id],
        undefined,
        async () => {
          const ready = await isTenantOperationsReady(
            organization.id,
          ).catch(() => false)

          if (!ready) return null

          return validateTenantCoupon(
            organization.id,
            code,
            subtotal,
          )
        },
        "public-store",
      )

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
        {
          status:
            error instanceof InputValidationError
              ? validationErrorStatus(error)
              : 400,
        },
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

  if (!session) {
    return NextResponse.json(
      { error: "Sessão tenant obrigatória." },
      { status: 401 },
    )
  }

  if (!(await isTenantOperationsReady(
    session.organizationId,
  ).catch(() => false))) {
    return NextResponse.json(
      { error: "Operações PostgreSQL indisponíveis para esta empresa." },
      { status: 503 },
    )
  }

  return NextResponse.json({
    coupons: await getTenantCoupons(
      session.organizationId,
      { includeInactive: true },
    ),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  try {
    const body = await readJsonObject(request, 16 * 1024)
    if (!body) throw new InputValidationError("Corpo da requisição obrigatório.")

    const session = await getVerifiedTenantSession()
    if (!session) {
      return NextResponse.json(
        { error: "Sessão tenant obrigatória." },
        { status: 401 },
      )
    }

    const ready = await isTenantOperationsReady(
      session.organizationId,
    ).catch(() => false)

    if (!ready) {
      return NextResponse.json(
        { error: "Operações PostgreSQL indisponíveis para esta empresa." },
        { status: 503 },
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

    const type = oneOf(body.type, "Tipo", ["percent", "fixed"] as const)
    const value = finiteNumber(body.value, "Valor", {
      min: 0.01,
      max: type === "percent" ? 100 : 1_000_000_000,
    })

    const input = {
      code: requiredText(body.code, "Código", COUPON_CODE_OPTIONS),
      description: optionalText(body.description, "Descrição", { maxLength: 240 }) || "",
      type,
      value,
      minimumOrder: finiteNumber(body.minimumOrder ?? 0, "Pedido mínimo", {
        min: 0,
        max: 100_000_000,
      }),
      active: optionalBoolean(body.active, "Ativo", true),
      ...(body.expiresAt
        ? { expiresAt: optionalIsoDateTime(body.expiresAt, "Validade") || undefined }
        : {}),
    }

    const coupon = await createTenantCoupon(
      session.organizationId,
      input,
    )

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
      {
        status:
          error instanceof InputValidationError
            ? validationErrorStatus(error)
            : 400,
      },
    )
  }
}
