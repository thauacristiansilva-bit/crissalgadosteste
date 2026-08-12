import { NextResponse } from "next/server"
import { listCommercialPlans } from "@/lib/billing-contracting"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const plans = await listCommercialPlans()
    return NextResponse.json({ plans })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível carregar os planos.",
    }, { status: 503 })
  }
}
