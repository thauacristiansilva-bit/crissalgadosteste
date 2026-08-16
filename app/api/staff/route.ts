import { NextResponse } from "next/server"
import {
  createTenantStaffMember,
  getTenantStaffMembers,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import {
  canManageAccess,
  canManageTeam,
  canViewTeam,
} from "@/lib/tenant-permissions"
import type { StaffEmploymentType, StaffRole } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canViewTeam(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode visualizar a equipe." },
      { status: 403 },
    )
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      const ready = await isTenantRuntimeReady(session.organizationId)

      if (!ready) {
        return NextResponse.json(
          {
            error:
              "O runtime PostgreSQL desta empresa não está pronto para consultar colaboradores.",
          },
          { status: 503 },
        )
      }

      return NextResponse.json({
        staffMembers: await getTenantStaffMembers(
          session.organizationId,
          { includeInactive: true },
        ),
      })
    },
    "tenant-session",
  )
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode cadastrar colaboradores." },
      { status: 403 },
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
    role: String(body.role || "cashier") as StaffRole,
    permissions: Array.isArray(body.permissions)
      ? body.permissions.map(String)
      : [],
    hireDate: body.hireDate !== undefined ? String(body.hireDate) : "",
    employmentType: body.employmentType ? String(body.employmentType) as StaffEmploymentType : null,
    notes: body.notes !== undefined ? String(body.notes) : "",
  }

  if (
    (input.role === "admin" || input.permissions.length > 0) &&
    !canManageAccess(session.role)
  ) {
    return NextResponse.json(
      {
        error:
          "Somente quem gerencia acessos pode criar administradores ou permissões personalizadas.",
      },
      { status: 403 },
    )
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
                "O runtime PostgreSQL desta empresa não está pronto para cadastrar colaboradores.",
            },
            { status: 503 },
          )
        }

        const staffMember = await createTenantStaffMember(
          session.organizationId,
          input,
        )

        return NextResponse.json(
          { staffMember },
          { status: 201 },
        )
      },
      "tenant-session",
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
