import { NextResponse } from "next/server"
import { demoPolicyErrorStatus } from "@/lib/demo-policy"
import {
  canAccessIntegrations,
  cancelIntegrationJob,
  deleteIntegrationConnection,
  enqueueCrmCampaign,
  setIntegrationConnectionStatus,
  upsertIntegrationConnection,
} from "@/lib/integrations-db"
import type { IntegrationProvider } from "@/lib/integration-providers"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ActionBody =
  | {
      action: "upsert_connection"
      connectionId?: string | null
      name: string
      provider: IntegrationProvider
      settings?: Record<string, unknown>
      credentials?: Record<string, unknown>
      enabled?: boolean
    }
  | { action: "set_connection_status"; connectionId: string; enabled: boolean }
  | { action: "delete_connection"; connectionId: string }
  | { action: "enqueue_campaign"; campaignId: string; connectionId: string }
  | { action: "cancel_job"; jobId: string }

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessIntegrations(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso às integrações." }, { status: 403 })
  }
  const body = (await request.json().catch(() => null)) as ActionBody | null
  if (!body?.action) return NextResponse.json({ error: "Ação inválida." }, { status: 400 })

  try {
    let result: unknown = null
    switch (body.action) {
      case "upsert_connection":
        result = await upsertIntegrationConnection(session, body)
        break
      case "set_connection_status":
        result = await setIntegrationConnectionStatus(session, body)
        break
      case "delete_connection":
        result = await deleteIntegrationConnection(session, body.connectionId)
        break
      case "enqueue_campaign":
        result = await enqueueCrmCampaign(session, body)
        break
      case "cancel_job":
        result = await cancelIntegrationJob(session, body.jobId)
        break
      default:
        return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 })
    }
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir a ação." },
      { status: demoPolicyErrorStatus(error) },
    )
  }
}
