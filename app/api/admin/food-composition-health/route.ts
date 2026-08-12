import { NextResponse } from "next/server"
import { getFoodCompositionStats } from "@/lib/food-composition-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão multiempresa inválida." },
      { status: 401 },
    )
  }

  try {
    const stats = await getFoodCompositionStats(session.organizationId)
    return NextResponse.json({
      ok: stats.ready,
      phase: "11-12",
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      foodComposition: stats,
      stock: {
        automaticConsumption: true,
        cancellationReversal: true,
        authoritativePricing: "server",
      },
      rls: {
        enforcement: "prepared-only",
        note: "As tabelas da Fase 11/12 recebem políticas preparadas, mas o RLS continua desligado até o rollout definitivo.",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "11-12",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível verificar complementos e estoque.",
      },
      { status: 503 },
    )
  }
}
