import { NextResponse } from "next/server"
import {
  canAccessFoodOperations,
  closeIngredientLot,
  createInventoryCount,
  createProductionRun,
  receiveIngredientLot,
  wasteIngredientLot,
} from "@/lib/food-operations-db"
import { foodOperationsRequestIsSameOrigin } from "@/lib/food-operations-request"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ActionBody =
  | {
      action: "receive_lot"
      ingredientId: number
      lotCode: string
      supplier?: string
      receivedAt?: string
      expiresAt?: string | null
      quantity: number
      unitCost: number
      note?: string
    }
  | { action: "waste_lot"; lotId: string; quantity: number; reason: string }
  | { action: "close_lot"; lotId: string }
  | {
      action: "create_production_run"
      productId: number
      batchCode: string
      plannedYield: number
      actualYield: number
      wasteQuantity?: number
      producedAt?: string
      note?: string
    }
  | {
      action: "inventory_count"
      reference: string
      note?: string
      items: Array<{ ingredientId: number; countedQuantity: number }>
    }

export async function POST(request: Request) {
  if (!foodOperationsRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessFoodOperations(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso à operação alimentar avançada." }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as ActionBody | null
  if (!body?.action) return NextResponse.json({ error: "Ação inválida." }, { status: 400 })

  try {
    let result: unknown = null
    switch (body.action) {
      case "receive_lot":
        result = await receiveIngredientLot(session, body)
        break
      case "waste_lot":
        result = await wasteIngredientLot(session, body)
        break
      case "close_lot":
        result = await closeIngredientLot(session, body)
        break
      case "create_production_run":
        result = await createProductionRun(session, body)
        break
      case "inventory_count":
        result = await createInventoryCount(session, body)
        break
      default:
        return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 })
    }
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir a ação." },
      { status: 400 },
    )
  }
}
