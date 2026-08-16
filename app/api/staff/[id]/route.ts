import { NextResponse } from "next/server"
import {
  isTenantRuntimeReady,
  updateTenantStaffMember,
} from "@/lib/organization-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import {
  canManageAccess,
  canManageTeam,
} from "@/lib/tenant-permissions"
import type { StaffRole } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar colaboradores." },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const numericId = Number(id)

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body || !Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  if (
    (body.permissions !== undefined || body.role === "admin") &&
    !canManageAccess(session.role)
  ) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode alterar permissões de acesso nem promover administradores.",
      },
      { status: 403 },
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
      ? { role: String(body.role) as StaffRole }
      : {}),
    ...(body.active !== undefined
      ? { active: Boolean(body.active) }
      : {}),
    ...(body.permissions !== undefined && Array.isArray(body.permissions)
      ? { permissions: body.permissions.map(String) }
      : {}),
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        const ready = await isTenantRuntimeReady(session.organizationId)

        if (!ready) {
          return NextResponse.json(
            {
              error:
                "O runtime PostgreSQL desta empresa não está pronto para alterar colaboradores.",
            },
            { status: 503 },
          )
        }

        const staffMember = await updateTenantStaffMember(
          session.organizationId,
          numericId,
          patch,
        )

        if (!staffMember) {
          return NextResponse.json(
            { error: "Colaborador não encontrado." },
            { status: 404 },
          )
        }

        return NextResponse.json({ staffMember })
      },
      "tenant-session",
    )
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
