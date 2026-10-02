import { NextResponse } from "next/server"
import { createCheckoutForUser } from "@/lib/billing-contracting"
import { getBillingIdentity } from "@/lib/billing-identity"
import type { BillingCycle, PaymentMethod } from "@/lib/billing-types"
import { requestIp, requestIsSameOrigin } from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function returnUrl(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/$/, "")
  if (configured) return `${configured}/contratar/retorno`
  const url = new URL(request.url)
  return `${url.origin}/contratar/retorno`
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 })
  }

  const identity = await getBillingIdentity()
  if (!identity) return NextResponse.json({ error: "Faça login ou crie sua conta para contratar." }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    planCode?: string
    billingCycle?: BillingCycle
    paymentMethod?: PaymentMethod
    contractAccepted?: boolean
    commitmentAccepted?: boolean
  } | null

  const cycles: BillingCycle[] = ["monthly", "semiannual", "annual"]
  const methods: PaymentMethod[] = ["pix", "credit_card", "boleto"]
  if (!body?.planCode || !cycles.includes(body.billingCycle as BillingCycle)) {
    return NextResponse.json({ error: "Plano e período de contratação são obrigatórios." }, { status: 400 })
  }
  if (!methods.includes(body.paymentMethod as PaymentMethod)) {
    return NextResponse.json({ error: "Escolha Pix, cartão ou boleto." }, { status: 400 })
  }
  if (body.contractAccepted !== true) {
    return NextResponse.json({ error: "Leia e aceite o Contrato de Licença e Assinatura antes de continuar." }, { status: 400 })
  }
  if (body.billingCycle !== "monthly" && body.commitmentAccepted !== true) {
    return NextResponse.json({ error: "Confirme que você leu a regra de permanência e rescisão antecipada antes de continuar." }, { status: 400 })
  }

  try {
    const result = await createCheckoutForUser({
      userId: identity.userId,
      email: identity.email,
      planCode: body.planCode,
      billingCycle: body.billingCycle as BillingCycle,
      paymentMethod: body.paymentMethod as PaymentMethod,
      contractAccepted: true,
      commitmentAccepted: body.billingCycle === "monthly" ? true : body.commitmentAccepted === true,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent") || "",
      returnUrl: returnUrl(request),
    })
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl, reused: result.reused })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível iniciar o checkout.",
    }, { status: 400 })
  }
}
