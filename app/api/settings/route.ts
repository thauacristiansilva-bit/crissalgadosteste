import { NextResponse } from "next/server"
import {
  getTenantSettings,
  isTenantRuntimeReady,
  updateTenantSettings,
} from "@/lib/organization-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import {
  canManageOrganizationSettings,
  canViewOrganizationSettings,
} from "@/lib/tenant-permissions"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import type { StoreSettings } from "@/lib/types"
import {
  assertOrganizationEntitlement,
  billingErrorStatus,
} from "@/lib/billing-db"
import {
  assertDemoSettingsPatchAllowed,
  demoPolicyErrorStatus,
  DemoPolicyError,
} from "@/lib/demo-policy"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canViewOrganizationSettings(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode acessar as configurações da empresa." },
      { status: 403 },
    )
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      const ready = await isTenantRuntimeReady(session.organizationId).catch(
        () => false,
      )

      if (!ready) {
        return NextResponse.json(
          { error: "Configurações PostgreSQL desta empresa não estão disponíveis." },
          { status: 503 },
        )
      }

      const settings = await getTenantSettings(session.organizationId)
      if (!settings) {
        return NextResponse.json(
          { error: "Configurações da empresa não encontradas." },
          { status: 404 },
        )
      }

      return NextResponse.json({ settings })
    },
    "tenant-session",
  )
}

export async function PATCH(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageOrganizationSettings(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar as configurações da empresa." },
      { status: 403 },
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

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      try {
        const ready = await isTenantRuntimeReady(session.organizationId).catch(
          () => false,
        )

        if (!ready) {
          return NextResponse.json(
            { error: "Configurações PostgreSQL desta empresa não estão disponíveis." },
            { status: 503 },
          )
        }

        await assertDemoSettingsPatchAllowed(
          session.organizationId,
          body as Record<string, unknown>,
        )

        if (body.deliveryEnabled === true) {
          await assertOrganizationEntitlement(session.organizationId, "delivery")
        }

        if (body.deliveryTrackingEnabled === true) {
          await assertOrganizationEntitlement(session.organizationId, "delivery")
        }

        if (body.loyaltyEnabled === true) {
          await assertOrganizationEntitlement(session.organizationId, "loyalty")
        }

        const settings = await updateTenantSettings(session.organizationId, {
          ...body,
          systemName: "SaborFlow",
        })

        return NextResponse.json({ settings })
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível salvar as configurações.",
          },
          {
            status:
              error instanceof DemoPolicyError
                ? demoPolicyErrorStatus(error)
                : billingErrorStatus(error),
          },
        )
      }
    },
    "tenant-session",
  )
}
