import { NextResponse } from "next/server"
import { createCheckoutForUser } from "@/lib/billing-contracting"
import { getBillingIdentity } from "@/lib/billing-identity"
import type { BillingCycle } from "@/lib/billing-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function returnUrl(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/$/, "")
  if (configured) return `${configured}/contratar/retorno`
  const url = new URL(request.url)
  return `${url.origin}/contratar/retorno`
}

export async function POST(request: Request) {
  const identity = await getBillingIdentity()
  if (!identity) return NextResponse.json({ error: "Faça login ou crie sua conta para contratar." }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    planCode?: string
    billingCycle?: BillingCycle
  } | null
  if (!body?.planCode || !["monthly", "annual"].includes(String(body.billingCycle))) {
    return NextResponse.json({ error: "Plano e ciclo de cobrança são obrigatórios." }, { status: 400 })
  }

  try {
    const result = await createCheckoutForUser({
      userId: identity.userId,
      email: identity.email,
      planCode: body.planCode,
      billingCycle: body.billingCycle as BillingCycle,
      returnUrl: returnUrl(request),
    })
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl, reused: result.reused })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível iniciar o checkout.",
    }, { status: 400 })
  }
}
