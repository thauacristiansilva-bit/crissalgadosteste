import { NextResponse } from "next/server"
import { canAccessFoodOperations, foodOperationsHealth } from "@/lib/food-operations-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (!canAccessFoodOperations(session)) {
    return NextResponse.json({ error: "Seu perfil não possui acesso à operação alimentar avançada." }, { status: 403 })
  }

  try {
    const health = await foodOperationsHealth(session)
    return NextResponse.json({
      ok: health.schemaReady && health.subscriptionActive && health.entitlementEnabled,
      phase: "22-advanced-food-operations",
      ...health,
      capabilities: {
        ingredientLotTraceability: true,
        expirationAlerts: true,
        weightedCostOnReceipt: true,
        lotWasteTracking: true,
        productionYieldTracking: true,
        effectiveProductionCost: true,
        physicalInventoryCounts: true,
        transactionalStockAdjustments: true,
      },
      boundaries: {
        tenantIsolationPreserved: true,
        inventoryEntitlementRequired: true,
        saleIngredientConsumptionAuthorityPreserved: true,
        productionRunsDoNotDoubleConsumeInventory: true,
        lotTraceabilityDoesNotReplaceIngredientStockAuthority: true,
        physicalCountsAreServerTransactional: true,
        rlsEnforcement: "prepared-only-until-phase-24",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "22-advanced-food-operations",
        error: error instanceof Error ? error.message : "Falha ao validar operação alimentar avançada.",
      },
      { status: 500 },
    )
  }
}
