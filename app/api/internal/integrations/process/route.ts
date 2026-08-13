import { NextResponse } from "next/server"
import { processIntegrationQueue } from "@/lib/integrations-db"
import { integrationWorkerRequestIsAuthorized } from "@/lib/integrations-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!integrationWorkerRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Worker não autorizado." }, { status: 401 })
  }
  const body = await request.json().catch(() => ({})) as { limit?: number }
  try {
    return NextResponse.json({ ok: true, ...(await processIntegrationQueue({ limit: body.limit })) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao processar fila de integrações." },
      { status: 500 },
    )
  }
}
