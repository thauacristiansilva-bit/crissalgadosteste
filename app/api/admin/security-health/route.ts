import { NextResponse } from "next/server"
import {
  getAdminLoginMode,
  isSessionSecretConfigured,
} from "@/lib/auth"
import {
  getAdminUserCredentialState,
} from "@/lib/admin-user-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  getOrganizationTimeZone,
  getRlsRolloutStats,
  isValidTimeZone,
  listOrganizationDomains,
  listPrintAgents,
} from "@/lib/organization-security-db"
import {
  listTeamAccess,
} from "@/lib/team-access-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sessão multiempresa inválida.",
      },
      { status: 401 },
    )
  }

  try {
    const [
      credential,
      timeZone,
      domains,
      printAgents,
      rls,
      teamAccess,
    ] = await Promise.all([
      getAdminUserCredentialState(
        session.email,
      ),
      getOrganizationTimeZone(
        session.organizationId,
      ),
      listOrganizationDomains(
        session.organizationId,
      ),
      listPrintAgents(
        session.organizationId,
      ),
      getRlsRolloutStats(),
      session.role === "owner" ||
      session.role === "admin"
        ? listTeamAccess(
            session.organizationId,
          )
        : Promise.resolve([]),
    ])

    const databasePasswordReady =
      Boolean(
        credential?.passwordReady,
      )

    const sessionSecretConfigured =
      isSessionSecretConfigured()

    const timeZoneValid =
      isValidTimeZone(
        timeZone,
      )

    const team = {
      profiles:
        teamAccess.length,
      activeLogins:
        teamAccess.filter(
          (item) =>
            item.membershipStatus ===
            "active",
        ).length,
      pendingInvites:
        teamAccess.filter(
          (item) =>
            item.membershipStatus ===
            "invited",
        ).length,
      disabledLogins:
        teamAccess.filter(
          (item) =>
            item.membershipStatus ===
            "disabled",
        ).length,
    }

    const domainStats = {
      total:
        domains.length,
      verified:
        domains.filter(
          (item) =>
            item.verified,
        ).length,
      pending:
        domains.filter(
          (item) =>
            !item.verified,
        ).length,
    }

    const printStats = {
      total:
        printAgents.length,
      active:
        printAgents.filter(
          (item) =>
            item.active,
        ).length,
    }

    const rlsPreparedSafely =
      rls.prepared &&
      rls.enabledCount === 0

    const rlsDefinitive =
      rls.prepared &&
      rls.preparedCount > 0 &&
      rls.enabledCount === rls.preparedCount

    const rlsHealthy =
      rlsPreparedSafely || rlsDefinitive

    return NextResponse.json({
      ok:
        databasePasswordReady &&
        sessionSecretConfigured &&
        timeZoneValid &&
        rlsHealthy,
      phase: 10,
      auth: {
        mode:
          getAdminLoginMode(),
        databasePasswordReady,
        sessionSecretConfigured,
        sessionVersion:
          session.sessionVersion,
      },
      organization: {
        id:
          session.organizationId,
        name:
          session.organizationName,
        slug:
          session.organizationSlug,
        role:
          session.role,
        timeZone,
        timeZoneValid,
      },
      team,
      domains: domainStats,
      printAgents:
        printStats,
      rls: {
        prepared:
          rls.prepared,
        safePrepared:
          rlsPreparedSafely,
        definitive:
          rlsDefinitive,
        preparedCount:
          rls.preparedCount,
        enabledCount:
          rls.enabledCount,
        enforcement:
          rlsDefinitive
            ? "enabled"
            : rls.enabledCount > 0
              ? "partial"
              : "prepared-only",
        note:
          rlsDefinitive
            ? "O enforcement tenant RLS está ativo. A validação de FORCE RLS e do papel restrito do runtime é feita em /api/admin/rls-health."
            : "As políticas RLS estão preparadas e o enforcement ainda não foi concluído.",
      },
      legacy: {
        dataFile: null,
        storeMirror: "disabled",
        adminLoginFallback: false,
        note:
          "Fase 25: store.json e login administrativo legado não participam mais do runtime.",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: 10,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível verificar a segurança da Fase 10.",
      },
      { status: 503 },
    )
  }
}
