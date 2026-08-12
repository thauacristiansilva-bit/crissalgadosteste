import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  getSettings as getLegacySettings,
  updateSettings as updateLegacySettings,
} from "@/lib/db"
import {
  getTenantSettings,
  isTenantRuntimeReady,
  updateTenantSettings,
} from "@/lib/organization-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageOrganizationSettings,
} from "@/lib/tenant-permissions"
import type { StoreSettings } from "@/lib/types"
import { assertOrganizationEntitlement, billingErrorStatus } from "@/lib/billing-db"
import { assertDemoSettingsPatchAllowed, demoPolicyErrorStatus, DemoPolicyError } from "@/lib/demo-policy"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (
    session &&
    (await isTenantRuntimeReady(
      session.organizationId,
    ).catch(() => false))
  ) {
    const settings = await getTenantSettings(
      session.organizationId,
    )

    if (settings) {
      return NextResponse.json({ settings })
    }
  }

  return NextResponse.json({
    settings: await getLegacySettings(),
  })
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<StoreSettings>
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantRuntimeReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const settings = await updateLegacySettings({
        ...body,
        systemName: "SaborFlow",
      })

      return NextResponse.json({ settings })
    }

    if (
      !canManageOrganizationSettings(
        session.role,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar as configurações da empresa.",
        },
        { status: 403 },
      )
    }

    await assertDemoSettingsPatchAllowed(session.organizationId, body as Record<string, unknown>)

    if (body.deliveryEnabled === true) {
      await assertOrganizationEntitlement(session.organizationId, "delivery")
    }
    if (body.loyaltyEnabled === true) {
      await assertOrganizationEntitlement(session.organizationId, "loyalty")
    }

    const settings = await updateTenantSettings(
      session.organizationId,
      {
        ...body,
        systemName: "SaborFlow",
      },
    )

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await updateLegacySettings(settings)
    }

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar as configurações.",
      },
      { status: error instanceof DemoPolicyError ? demoPolicyErrorStatus(error) : billingErrorStatus(error) },
    )
  }
}
