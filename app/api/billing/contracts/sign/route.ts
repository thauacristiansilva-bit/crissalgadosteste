import { NextResponse } from "next/server"
import { getBillingIdentity } from "@/lib/billing-identity"
import type { BillingCycle, PaymentMethod } from "@/lib/billing-types"
import { requestIp, requestIsSameOrigin } from "@/lib/security/request-security"
import { signSubscriptionContract } from "@/lib/contract-signing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 })
  const identity = await getBillingIdentity()
  if (!identity) return NextResponse.json({ error: "Entre na sua conta antes de assinar." }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    planCode?: string
    billingCycle?: BillingCycle
    paymentMethod?: PaymentMethod
    signatureDataUrl?: string
    termsAccepted?: boolean
    privacyAccepted?: boolean
    contractAccepted?: boolean
    commitmentAccepted?: boolean
  } | null
  if (typeof body?.signatureDataUrl === "string" && body.signatureDataUrl.length > 700_000) {
    return NextResponse.json({ error: "A assinatura ficou grande demais. Limpe o quadro e assine novamente." }, { status: 413 })
  }

  const cycles: BillingCycle[] = ["monthly", "semiannual", "annual"]
  const methods: PaymentMethod[] = ["pix", "credit_card", "boleto"]
  if (!body?.planCode || !cycles.includes(body.billingCycle as BillingCycle) || !methods.includes(body.paymentMethod as PaymentMethod) || !body.signatureDataUrl) {
    return NextResponse.json({ error: "Confira o plano, a forma de pagamento e a assinatura." }, { status: 400 })
  }

  try {
    const signed = await signSubscriptionContract({
      userId: identity.userId,
      email: identity.email,
      planCode: body.planCode,
      billingCycle: body.billingCycle as BillingCycle,
      paymentMethod: body.paymentMethod as PaymentMethod,
      signatureDataUrl: body.signatureDataUrl,
      termsAccepted: body.termsAccepted === true,
      privacyAccepted: body.privacyAccepted === true,
      contractAccepted: body.contractAccepted === true,
      commitmentAccepted: body.billingCycle === "monthly" ? true : body.commitmentAccepted === true,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent") || "",
    })
    return NextResponse.json({ ok: true, contractId: signed.id, signedAt: signed.signedAt, pdfUrl: `/api/billing/contracts/${signed.id}/pdf` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível assinar o contrato." }, { status: 400 })
  }
}
