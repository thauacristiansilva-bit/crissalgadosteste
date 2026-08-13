import { NextResponse } from "next/server"
import { receiveSignedIntegrationWebhook } from "@/lib/integrations-db"
import { runWithRlsBypass } from "@/lib/rls-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params
  const rawBody = await request.text()
  if (rawBody.length > 1_000_000) {
    return NextResponse.json({ error: "Payload excede o limite permitido." }, { status: 413 })
  }
  const payload = (() => {
    try {
      const value = rawBody ? JSON.parse(rawBody) : {}
      return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
    } catch {
      return null
    }
  })()
  if (!payload) return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 })

  try {
    const result = await runWithRlsBypass(() =>
      receiveSignedIntegrationWebhook({
        connectionId,
        rawBody,
        payload,
        signature: request.headers.get("x-saborflow-signature"),
        providerEventId: request.headers.get("x-saborflow-event-id"),
        eventType: request.headers.get("x-saborflow-event-type"),
      }),
    )
    return NextResponse.json({ ok: true, duplicate: result.duplicate })
  } catch (error) {
    console.error("[SaborFlow Integrations] Webhook rejeitado:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Webhook rejeitado." }, { status: 401 })
  }
}
