import { NextResponse } from "next/server"
import { getTenantSettings } from "@/lib/organization-db"
import { isWithinBusinessHours } from "@/lib/operations"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const settings = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => getTenantSettings(session.organizationId),
      "tenant-session",
    )

    if (!settings) {
      return NextResponse.json(
        {
          ok: false,
          phase: "25.7.5-after-hours-scheduled-orders",
          error: "Configurações da empresa não encontradas.",
        },
        { status: 503 },
      )
    }

    const withinBusinessHours = isWithinBusinessHours(settings, new Date())
    const onlineOrdersEnabled = Boolean(settings.acceptingOrders)

    return NextResponse.json({
      ok: true,
      phase: "25.7.5-after-hours-scheduled-orders",
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        slug: session.organizationSlug,
      },
      current: {
        acceptingOrders: onlineOrdersEnabled,
        withinBusinessHours,
        immediateOrderingAllowed: onlineOrdersEnabled && withinBusinessHours,
        scheduledOrderingAllowed: onlineOrdersEnabled,
        timeZone: settings.timeZone || "America/Sao_Paulo",
      },
      scheduling: {
        daysAhead: settings.schedulingDaysAhead,
        slotIntervalMinutes: settings.slotIntervalMinutes,
        deliveryLeadMinutes: settings.deliveryMinMinutes,
        pickupLeadMinutes: settings.pickupLeadMinutes,
      },
      capabilities: {
        publicCheckoutRemainsAvailableOutsideBusinessHours: true,
        afterHoursCheckoutForcesScheduledTiming: true,
        immediateOrdersBlockedOutsideBusinessHours: true,
        scheduledOrdersValidatedAgainstBusinessHours: true,
        manualAcceptingOrdersSwitchStillBlocksAllOnlineOrders: true,
        postgresqlTenantAwareCheckoutPreserved: true,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "25.7.5-after-hours-scheduled-orders",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar o agendamento fora do expediente.",
      },
      { status: 503 },
    )
  }
}
