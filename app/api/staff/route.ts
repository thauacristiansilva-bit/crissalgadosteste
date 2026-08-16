import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createStaffMember as createLegacyStaffMember,
  getStaffMembers as getLegacyStaffMembers,
  syncLegacyStaffMemberFromTenant,
} from "@/lib/db"
import {
  createTenantStaffMember,
  getTenantStaffMembers,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageAccess,
  canManageTeam,
  canViewTeam,
} from "@/lib/tenant-permissions"
import type { StaffRole } from "@/lib/types"

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
    !canViewTeam(session.role)
  ) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode visualizar a equipe.",
      },
      { status: 403 },
    )
  }

  if (
    session &&
    (await isTenantRuntimeReady(
      session.organizationId,
    ).catch(() => false))
  ) {
    return NextResponse.json({
      staffMembers: await getTenantStaffMembers(
        session.organizationId,
        { includeInactive: true },
      ),
    })
  }

  return NextResponse.json({
    staffMembers: await getLegacyStaffMembers(),
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const input = {
    name: String(body.name || ""),
    email: String(body.email || ""),
    phone: String(body.phone || ""),
    role: String(
      body.role || "cashier",
    ) as StaffRole,
    permissions: Array.isArray(body.permissions)
      ? body.permissions.map(String)
      : [],
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
        await createLegacyStaffMember(input)

      return NextResponse.json(
        { staffMember },
        { status: 201 },
      )
    }

    if (!canManageTeam(session.role)) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode cadastrar colaboradores.",
        },
        { status: 403 },
      )
    }

    if (
      (input.role === "admin" || input.permissions.length > 0) &&
      !canManageAccess(session.role)
    ) {
      return NextResponse.json(
        {
          error: "Somente quem gerencia acessos pode criar administradores ou permissões personalizadas.",
        },
        { status: 403 },
      )
    }

    const staffMember =
      await createTenantStaffMember(
        session.organizationId,
        input,
      )

    if (
      await isCurrentDeploymentOrganization(
        session.organizationId,
      )
    ) {
      await syncLegacyStaffMemberFromTenant(
        staffMember,
      )
    }

    return NextResponse.json(
      { staffMember },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar.",
      },
      { status: 400 },
    )
  }
}
