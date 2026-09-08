import { NextResponse } from "next/server"
import { canManageCommercialState, canManageSupport, canReviewRegistrations, getSuperadminAccess } from "@/lib/superadmin-auth"
import { changeSubscriptionPlan, createCommercialCoupon, setBillingAccountStatus, setEntitlementOverride, setRegistrationReview, setSupportCaseStatus } from "@/lib/superadmin-db"
import { requestIp, superadminRequestIsSameOrigin } from "@/lib/superadmin-request"
import type { PlanEntitlementKey } from "@/lib/billing-types"
import {
  finiteNumber,
  InputValidationError,
  oneOf,
  optionalIsoDateTime,
  optionalText,
  readJsonObject,
  requiredText,
  validationErrorStatus,
} from "@/lib/security/input-validation"

export const dynamic = "force-dynamic"

const ID_OPTIONS = {
  maxLength: 128,
  allowNewlines: false,
} as const

export async function POST(request: Request) {
  if (!superadminRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }

  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })

  try {
    const body = await readJsonObject(request, 32 * 1024)
    if (!body) throw new InputValidationError("Corpo da requisição obrigatório.")

    const action = requiredText(body.action, "Ação", {
      maxLength: 64,
      allowNewlines: false,
    })
    const ip = requestIp(request)

    if (action === "review-registration") {
      if (!canReviewRegistrations(access.role)) {
        return NextResponse.json({ error: "Sem permissão para validar cadastros." }, { status: 403 })
      }

      const status = oneOf(body.status, "Status", ["approved", "rejected"] as const)
      const billingAccountId = requiredText(body.billingAccountId, "Conta de cobrança", ID_OPTIONS)
      const notes = optionalText(body.notes, "Observações", { maxLength: 2_000 }) || ""

      await setRegistrationReview(access, billingAccountId, status, notes, ip)
    } else if (action === "set-account-status") {
      if (!canManageCommercialState(access.role)) {
        return NextResponse.json({ error: "Sem permissão para alterar cobrança." }, { status: 403 })
      }

      const status = oneOf(body.status, "Status", ["active", "suspended"] as const)
      const accountId = requiredText(body.accountId, "Conta", ID_OPTIONS)
      await setBillingAccountStatus(access, accountId, status, ip)
    } else if (action === "change-plan") {
      if (!canManageCommercialState(access.role)) {
        return NextResponse.json({ error: "Sem permissão para alterar planos." }, { status: 403 })
      }

      const subscriptionId = requiredText(body.subscriptionId, "Assinatura", ID_OPTIONS)
      const planId = requiredText(body.planId, "Plano", ID_OPTIONS)
      await changeSubscriptionPlan(access, subscriptionId, planId, ip)
    } else if (action === "set-entitlement") {
      if (!canManageCommercialState(access.role)) {
        return NextResponse.json({ error: "Sem permissão para liberar recursos." }, { status: 403 })
      }

      const accountId = requiredText(body.accountId, "Conta", ID_OPTIONS)
      const key = requiredText(body.key, "Recurso", {
        maxLength: 80,
        allowNewlines: false,
        pattern: /^[A-Za-z0-9._-]+$/,
      }) as PlanEntitlementKey

      const entitlementValue = body.value
      if (
        entitlementValue !== null &&
        !["boolean", "number", "string"].includes(typeof entitlementValue)
      ) {
        throw new InputValidationError("Valor do recurso inválido.")
      }

      await setEntitlementOverride(access, accountId, key, entitlementValue, ip)
    } else if (action === "create-coupon") {
      if (!canManageCommercialState(access.role)) {
        return NextResponse.json({ error: "Sem permissão para gerenciar cupons." }, { status: 403 })
      }

      const discountType = oneOf(
        body.discountType,
        "Tipo de desconto",
        ["percent", "fixed"] as const,
      )
      const discountValue = finiteNumber(body.discountValue, "Valor do desconto", {
        min: 0.01,
        max: discountType === "percent" ? 100 : 1_000_000_000,
      })

      await createCommercialCoupon(access, {
        code: requiredText(body.code, "Código", {
          maxLength: 40,
          allowNewlines: false,
          pattern: /^[A-Za-z0-9_-]+$/,
        }),
        description: optionalText(body.description, "Descrição", { maxLength: 240 }) || "",
        discountType,
        discountValue,
        validUntil: optionalIsoDateTime(body.validUntil, "Validade"),
      }, ip)
    } else if (action === "support-status") {
      if (!canManageSupport(access.role)) {
        return NextResponse.json({ error: "Sem permissão para gerenciar suporte." }, { status: 403 })
      }

      const status = oneOf(
        body.status,
        "Status",
        ["open", "pending", "resolved", "closed"] as const,
      )
      const caseId = requiredText(body.caseId, "Chamado", ID_OPTIONS)
      await setSupportCaseStatus(access, caseId, status, ip)
    } else {
      return NextResponse.json({ error: "Ação não suportada." }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar ação.",
      },
      { status: validationErrorStatus(error) },
    )
  }
}
