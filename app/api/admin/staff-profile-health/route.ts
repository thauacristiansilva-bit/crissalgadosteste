import { NextResponse } from "next/server"
import {
  getTenantStaffMembers,
  isTenantRuntimeReady,
} from "@/lib/organization-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canViewTeam } from "@/lib/tenant-permissions"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
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
      const runtimeReady = await isTenantRuntimeReady(session.organizationId)

      try {
        const staffMembers = runtimeReady
          ? await getTenantStaffMembers(session.organizationId, {
              includeInactive: true,
            })
          : []

        return NextResponse.json({
          ok: runtimeReady,
          phase: "25.3.2-staff-profile-management",
          schemaReady: runtimeReady,
          organization: {
            id: session.organizationId,
            role: session.role,
          },
          counts: {
            staffMembers: staffMembers.length,
            active: staffMembers.filter((item) => item.active).length,
            withEmail: staffMembers.filter((item) => Boolean(item.email)).length,
            withPhone: staffMembers.filter((item) => Boolean(item.phone)).length,
            withHireDate: staffMembers.filter((item) => Boolean(item.hireDate)).length,
            withEmploymentType: staffMembers.filter((item) => Boolean(item.employmentType)).length,
            withNotes: staffMembers.filter((item) => Boolean(item.notes)).length,
          },
          capabilities: {
            editOperationalProfile: true,
            editContactData: true,
            editEmploymentDetails: true,
            changeRoleRequiresAccessManage: true,
            perEmployeePermissionsPreserved: true,
            invitationFlowPreserved: true,
            passwordRecoveryPreserved: true,
            accessRevocationPreserved: true,
            postgresTenantAware: true,
          },
          boundaries: {
            storeJsonFallbackDisabled: true,
            employeeProfileDoesNotBypassRls: true,
            activeLoginEmailIsNotSilentlyRewritten: true,
            ownerCannotBeCreatedAsStaffRole: true,
          },
        })
      } catch (error) {
        const pgError = error as { code?: string }
        const schemaReady = pgError?.code !== "42703"

        return NextResponse.json(
          {
            ok: false,
            phase: "25.3.2-staff-profile-management",
            schemaReady,
            runtimeReady,
            error:
              pgError?.code === "42703"
                ? "Migration 026_staff_profile_details ainda não foi aplicada."
                : error instanceof Error
                  ? error.message
                  : "Não foi possível validar os perfis da equipe.",
          },
          { status: 503 },
        )
      }
    },
    "tenant-session",
  )
}
