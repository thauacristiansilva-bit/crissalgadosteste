import { NextResponse } from "next/server"
import { canManageCommercialState, canManageSupport, getSuperadminAccess } from "@/lib/superadmin-auth"
import { changeSubscriptionPlan, createCommercialCoupon, setBillingAccountStatus, setEntitlementOverride, setSupportCaseStatus } from "@/lib/superadmin-db"
import { requestIp, superadminRequestIsSameOrigin } from "@/lib/superadmin-request"
import type { PlanEntitlementKey } from "@/lib/billing-types"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!superadminRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  try {
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action || "")
    const ip = requestIp(request)

    if (action === "set-account-status") {
      if (!canManageCommercialState(access.role)) return NextResponse.json({ error: "Sem permissão para alterar cobrança." }, { status: 403 })
      const status = String(body.status || "")
      if (status !== "active" && status !== "suspended") throw new Error("Status inválido.")
      await setBillingAccountStatus(access, String(body.accountId || ""), status, ip)
    } else if (action === "change-plan") {
      if (!canManageCommercialState(access.role)) return NextResponse.json({ error: "Sem permissão para alterar planos." }, { status: 403 })
      await changeSubscriptionPlan(access, String(body.subscriptionId || ""), String(body.planId || ""), ip)
    } else if (action === "set-entitlement") {
      if (!canManageCommercialState(access.role)) return NextResponse.json({ error: "Sem permissão para liberar recursos." }, { status: 403 })
      await setEntitlementOverride(access, String(body.accountId || ""), String(body.key || "") as PlanEntitlementKey, body.value, ip)
    } else if (action === "create-coupon") {
      if (!canManageCommercialState(access.role)) return NextResponse.json({ error: "Sem permissão para gerenciar cupons." }, { status: 403 })
      const discountType = String(body.discountType || "")
      if (discountType !== "percent" && discountType !== "fixed") throw new Error("Tipo de desconto inválido.")
      await createCommercialCoupon(access, {
        code: String(body.code || ""),
        description: String(body.description || ""),
        discountType,
        discountValue: Number(body.discountValue),
        validUntil: body.validUntil ? String(body.validUntil) : null,
      }, ip)
    } else if (action === "support-status") {
      if (!canManageSupport(access.role)) return NextResponse.json({ error: "Sem permissão para gerenciar suporte." }, { status: 403 })
      const status = String(body.status || "")
      if (!["open", "pending", "resolved", "closed"].includes(status)) throw new Error("Status inválido.")
      await setSupportCaseStatus(access, String(body.caseId || ""), status as "open" | "pending" | "resolved" | "closed", ip)
    } else {
      return NextResponse.json({ error: "Ação não suportada." }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao executar ação." }, { status: 400 })
  }
}
