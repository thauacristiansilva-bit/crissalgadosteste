import { NextResponse } from "next/server"
import {
  getCommercialOnboardingSnapshot,
  publishCommercialOnboarding,
  saveCommercialOnboardingStep,
  type CommercialOnboardingStep,
} from "@/lib/commercial-onboarding"
import { billingErrorStatus } from "@/lib/billing-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function ownerSession() {
  const session = await getVerifiedTenantSession()
  if (!session) return { error: "Não autorizado.", status: 401 as const }
  if (session.role !== "owner") {
    return {
      error: "Somente o proprietário pode concluir o onboarding comercial da loja.",
      status: 403 as const,
    }
  }
  return { session }
}

export async function GET() {
  const auth = await ownerSession()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const onboarding = await getCommercialOnboardingSnapshot(auth.session.organizationId)
  if (!onboarding) {
    return NextResponse.json(
      { error: "A migration da Fase 15 ainda não foi aplicada." },
      { status: 503 },
    )
  }

  return NextResponse.json({ onboarding })
}

export async function PATCH(request: Request) {
  const auth = await ownerSession()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as
    | { step?: CommercialOnboardingStep; data?: Record<string, unknown> }
    | null

  if (!body?.step || !body.data) {
    return NextResponse.json({ error: "Etapa e dados são obrigatórios." }, { status: 400 })
  }

  try {
    const onboarding = await saveCommercialOnboardingStep(
      auth.session.organizationId,
      auth.session.userId,
      body.step,
      body.data,
    )
    return NextResponse.json({ ok: true, onboarding })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível salvar a etapa.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}

export async function POST(request: Request) {
  const auth = await ownerSession()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  if (body?.action !== "publish") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  }

  try {
    const onboarding = await publishCommercialOnboarding(
      auth.session.organizationId,
      auth.session.userId,
    )
    return NextResponse.json({ ok: true, onboarding })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível publicar a loja.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
