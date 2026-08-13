import { NextResponse } from "next/server"
import {
  adjustCustomerLoyalty,
  canAccessCrm,
  createCrmCampaign,
  redeemCustomerLoyalty,
  setCrmCampaignStatus,
  updateCrmCustomerProfile,
  type CrmAudienceSegment,
  type CrmCampaignChannel,
  type CrmCampaignStatus,
} from "@/lib/crm-db"
import { crmRequestIsSameOrigin } from "@/lib/crm-request"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ActionBody =
  | {
      action: "update_customer"
      customerKey: string
      accountId?: number | null
      tags?: string[]
      notes?: string
      marketingOptIn?: boolean
      markContacted?: boolean
    }
  | { action: "adjust_loyalty"; accountId: number; points: number; reason: string }
  | { action: "redeem_loyalty"; accountId: number }
  | {
      action: "create_campaign"
      name: string
      channel: CrmCampaignChannel
      audienceSegment: CrmAudienceSegment
      message: string
      couponCode?: string
      scheduledFor?: string | null
    }
  | { action: "set_campaign_status"; campaignId: string; status: CrmCampaignStatus }

export async function POST(request: Request) {
  if (!crmRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessCrm(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso ao CRM e fidelidade." }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as ActionBody | null
  if (!body?.action) return NextResponse.json({ error: "Ação inválida." }, { status: 400 })

  try {
    switch (body.action) {
      case "update_customer":
        await updateCrmCustomerProfile(session, body)
        break
      case "adjust_loyalty":
        await adjustCustomerLoyalty(session, body)
        break
      case "redeem_loyalty":
        await redeemCustomerLoyalty(session, body)
        break
      case "create_campaign":
        await createCrmCampaign(session, body)
        break
      case "set_campaign_status":
        await setCrmCampaignStatus(session, body)
        break
      default:
        return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir a ação." },
      { status: 400 },
    )
  }
}
