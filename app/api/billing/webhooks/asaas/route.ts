import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { deterministicWebhookEventId, processBillingWebhook } from "@/lib/billing-contracting"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function validToken(received: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || ""
  if (!expected || !received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!validToken(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "Token do webhook inválido." }, { status: 401 })
  }

  const rawBody = await request.text()
  const payload = (() => {
    try {
      return rawBody ? JSON.parse(rawBody) as {
        id?: string
        event?: string
        payment?: { id?: string; subscription?: string | null }
        subscription?: { id?: string }
      } : {}
    } catch {
      return null
    }
  })()
  if (!payload) return NextResponse.json({ error: "Payload inválido." }, { status: 400 })

  const resourceId = payload.subscription?.id || payload.payment?.subscription || payload.payment?.id || null
  try {
    const result = await processBillingWebhook({
      provider: "asaas",
      providerEventId: deterministicWebhookEventId(rawBody, payload.id),
      eventType: payload.event || null,
      resourceId,
      payload,
    })
    return NextResponse.json({ ok: true, duplicate: result.duplicate })
  } catch (error) {
    console.error("[SaborFlow Billing] Erro ao processar webhook Asaas:", error)
    return NextResponse.json({ error: "Falha temporária ao processar webhook." }, { status: 500 })
  }
}
