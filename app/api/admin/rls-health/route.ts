import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getPostgresPool, getRlsRuntimeBridgeStatus } from "@/lib/postgres"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RolloutRow = {
  total: string | number
  enabled: string | number
  forced: string | number
  policies: string | number
}

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const pool = getPostgresPool()

    const [bridge, rollout, exemptions, scopedVisibility, unscopedVisibility] =
      await Promise.all([
        getRlsRuntimeBridgeStatus(),
        pool.query<RolloutRow>(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE r.enforcement = 'enabled'
                AND COALESCE(c.relrowsecurity, false)
            )::int AS enabled,
            COUNT(*) FILTER (
              WHERE r.enforcement = 'enabled'
                AND COALESCE(c.relrowsecurity, false)
                AND COALESCE(c.relforcerowsecurity, false)
            )::int AS forced,
            COUNT(*) FILTER (
              WHERE EXISTS (
                SELECT 1
                FROM pg_policies p
                WHERE p.schemaname = 'public'
                  AND p.tablename = r.table_name
                  AND p.policyname = 'sf_tenant_guard'
              )
            )::int AS policies
          FROM sf_rls_rollout r
          LEFT JOIN pg_class c
            ON c.oid = to_regclass('public.' || r.table_name)
        `),
        pool.query<{ table_name: string; scope: string; reason: string }>(`
          SELECT table_name, scope, reason
          FROM sf_rls_exemptions
          ORDER BY table_name ASC
        `).catch(() => ({ rows: [] })),
        runWithTenantRlsScope(
          [session.organizationId],
          session.userId,
          () => pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM sf_organization_settings WHERE organization_id = $1`,
            [session.organizationId],
          ),
          "tenant-session",
        ),
        runWithTenantRlsScope(
          [],
          session.userId,
          () => pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM sf_organization_settings WHERE organization_id = $1`,
            [session.organizationId],
          ),
          "tenant-session",
        ),
      ])

    const stats = rollout.rows[0]
    const total = Number(stats?.total || 0)
    const enabled = Number(stats?.enabled || 0)
    const forced = Number(stats?.forced || 0)
    const policies = Number(stats?.policies || 0)
    const currentTenantVisible = Number(scopedVisibility.rows[0]?.count || 0) > 0
    const sameTenantHiddenWithoutScope = Number(unscopedVisibility.rows[0]?.count || 0) === 0

    const ready =
      bridge.roleAvailable &&
      total > 0 &&
      total === enabled &&
      total === forced &&
      total === policies &&
      currentTenantVisible &&
      sameTenantHiddenWithoutScope

    return NextResponse.json({
      ok: ready,
      phase: "24-definitive-postgres-rls",
      schemaReady: total > 0,
      runtimeRole: bridge,
      rollout: {
        total,
        enabled,
        forced,
        policies,
        enforcement: ready ? "enabled-and-forced" : "incomplete",
      },
      isolationProbe: {
        currentTenantVisible,
        sameTenantHiddenWithoutScope,
        failClosedWhenUnscoped: bridge.failClosedWhenUnscoped,
      },
      exemptions: exemptions.rows,
      boundaries: {
        postgresRlsIsEnforced: ready,
        tableOwnerBypassNeutralizedByRuntimeRole: bridge.roleAvailable,
        requestTenantContextRequired: true,
        corporateReportsUseExplicitMultiTenantScope: true,
        privilegedBackendBypassIsExplicit: true,
        browserCannotSetRlsBypass: true,
        controlPlaneTablesRemainBackendAuthorized: true,
      },
    }, { status: ready ? 200 : 503 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        phase: "24-definitive-postgres-rls",
        error: error instanceof Error ? error.message : "Falha ao validar RLS.",
      },
      { status: 500 },
    )
  }
}
