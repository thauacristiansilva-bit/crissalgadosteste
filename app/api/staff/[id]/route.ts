import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  syncLegacyStaffMemberFromTenant,
  updateStaffMember as updateLegacyStaffMember,
} from "@/lib/db"
import {
  isTenantRuntimeReady,
  updateTenantStaffMember,
} from "@/lib/organization-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageTeam,
} from "@/lib/tenant-permissions"
import type { StaffRole } from "@/lib/types"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body || !Number.isInteger(numericId)) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const patch = {
    ...(body.name !== undefined
      ? { name: String(body.name) }
      : {}),
    ...(body.email !== undefined
      ? { email: String(body.email) }
      : {}),
    ...(body.phone !== undefined
      ? { phone: String(body.phone) }
      : {}),
    ...(body.role !== undefined
      ? {
          role: String(
            body.role,
          ) as StaffRole,
        }
      : {}),
    ...(body.active !== undefined
      ? { active: Boolean(body.active) }
      : {}),
    ...(body.permissions !== undefined &&
    Array.isArray(body.permissions)
      ? {
          permissions:
            body.permissions.map(String),
        }
      : {}),
  }

  try {
    const session = await getVerifiedTenantSession()
    const ready =
      session &&
      (await isTenantRuntimeReady(
        session.organizationId,
      ).catch(() => false))

    if (!session || !ready) {
      const staffMember =
        await updateLegacyStaffMember(
          numericId,
          patch,
        )

      return staffMember
        ? NextResponse.json({ staffMember })
        : NextResponse.json(
            {
              error:
                "Colaborador não encontrado.",
            },
            { status: 404 },
          )
    }

    if (!canManageTeam(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode alterar colaboradores.",
        },
        { status: 403 },
      )
    }

    const staffMember =
      await updateTenantStaffMember(
        session.organizationId,
        numericId,
        patch,
      )

    if (!staffMember) {
      return NextResponse.json(
        {
          error:
            "Colaborador não encontrado.",
        },
        { status: 404 },
      )
    }

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyStaffMemberFromTenant(
        staffMember,
      )
    }

    return NextResponse.json({ staffMember })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar.",
      },
      { status: 400 },
    )
  }
}
