import { NextResponse } from "next/server"
import {
  deterministicWebhookEventId,
  processBillingWebhook,
} from "@/lib/billing-contracting"
import { validateMercadoPagoWebhookSignature } from "@/lib/mercado-pago-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const payload = (() => {
    try {
      return rawBody ? JSON.parse(rawBody) as {
        id?: string | number
        type?: string
        action?: string
        data?: { id?: string | number }
      } : {}
    } catch {
      return null
    }
  })()

  if (!payload) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
  }

  const url = new URL(request.url)
  const queryDataId = url.searchParams.get("data.id") || url.searchParams.get("data_id")
  const resourceId = queryDataId || (payload.data?.id == null ? null : String(payload.data.id))

  let signatureValid = false
  try {
    signatureValid = validateMercadoPagoWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: queryDataId,
    })
  } catch (error) {
    console.error("[SaborFlow Billing] Falha ao validar assinatura do webhook:", error)
  }

  if (!signatureValid) {
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 })
  }

  const providerEventId = deterministicWebhookEventId(rawBody, payload.id)
  const eventType = payload.type || null

  try {
    const result = await processBillingWebhook({
      provider: "mercado_pago",
      providerEventId,
      eventType,
      resourceId,
      payload,
    })
    return NextResponse.json({ ok: true, duplicate: result.duplicate })
  } catch (error) {
    console.error("[SaborFlow Billing] Erro ao processar webhook Mercado Pago:", error)
    return NextResponse.json({ error: "Falha temporária ao processar webhook." }, { status: 500 })
  }
}
