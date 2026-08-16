import { NextResponse } from "next/server"
import { legacyStoreRuntimeEnabled } from "@/lib/db"
import { isTenantOperationsReady } from "@/lib/operations-db"
import { getPostgresPool, getRlsRuntimeBridgeStatus } from "@/lib/postgres"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sessão multiempresa inválida." },
      { status: 401 },
    )
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        const [operationsReady, bridge, counts] = await Promise.all([
          isTenantOperationsReady(session.organizationId),
          getRlsRuntimeBridgeStatus(),
          getPostgresPool().query<{
            cash_sessions: number
            financial_entries: number
            pending_invites: number
          }>(
            `
              SELECT
                (
                  SELECT COUNT(*)::int
                  FROM sf_cash_sessions
                  WHERE organization_id = $1
                ) AS cash_sessions,
                (
                  SELECT COUNT(*)::int
                  FROM sf_financial_entries
                  WHERE organization_id = $1
                ) AS financial_entries,
                (
                  SELECT COUNT(*)::int
                  FROM sf_auth_tokens
                  WHERE organization_id = $1
                    AND purpose = 'invite'
                    AND used_at IS NULL
                    AND expires_at > now()
                ) AS pending_invites
            `,
            [session.organizationId],
          ),
        ])

        const row = counts.rows[0] || {
          cash_sessions: 0,
          financial_entries: 0,
          pending_invites: 0,
        }
        const legacyDisabled = !legacyStoreRuntimeEnabled()
        const ok =
          operationsReady &&
          bridge.roleAvailable &&
          legacyDisabled

        return NextResponse.json(
          {
            ok,
            phase: "25.6-finance-cash-invitation-hardening",
            organization: {
              id: session.organizationId,
              name: session.organizationName,
              slug: session.organizationSlug,
            },
            authority: {
              database: "postgresql",
              operationsReady,
              legacyStoreRuntimeEnabled: !legacyDisabled,
              financialLegacyFallback: false,
              cashLegacyFallback: false,
            },
            rls: {
              runtimeRole: bridge.role,
              roleAvailable: bridge.roleAvailable,
              failClosedWhenUnscoped: bridge.failClosedWhenUnscoped,
            },
            counts: {
              cashSessions: Number(row.cash_sessions || 0),
              financialEntries: Number(row.financial_entries || 0),
              pendingInvites: Number(row.pending_invites || 0),
            },
            capabilities: {
              expensePostgresWrite: true,
              otherIncomePostgresWrite: true,
              cashPostgresWrite: true,
              financialValidation: true,
              cashValidation: true,
              invitationTokenBootstrapIndependentFromAdminSession: true,
              invitationAcceptanceAtomic: true,
              financeAndCashFeedbackSeparatedInUi: true,
            },
          },
          { status: ok ? 200 : 503 },
        )
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "25.6-finance-cash-invitation-hardening",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar a Fase 25.6.",
      },
      { status: 500 },
    )
  }
}
