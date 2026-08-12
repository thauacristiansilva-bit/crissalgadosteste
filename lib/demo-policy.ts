import { getPostgresPool } from "@/lib/postgres"

export type DemoKind = "public" | "trial"

export type DemoEnvironmentSnapshot = {
  id: string
  kind: DemoKind
  status: "active" | "expired" | "closed"
  organizationId: string
  expiresAt: string
  startedAt: string
  lastSeenAt: string
  requestedByUserId: string | null
}

export class DemoPolicyError extends Error {
  status: number
  code: string

  constructor(message: string, code = "demo_action_blocked", status = 403) {
    super(message)
    this.name = "DemoPolicyError"
    this.status = status
    this.code = code
  }
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function missingDemoSchema(error: unknown) {
  return (error as { code?: string })?.code === "42P01"
}

export async function getDemoEnvironmentForOrganization(
  organizationId: string,
): Promise<DemoEnvironmentSnapshot | null> {
  try {
    const result = await getPostgresPool().query<{
      id: string
      kind: DemoKind
      status: "active" | "expired" | "closed"
      organization_id: string
      expires_at: Date | string
      started_at: Date | string
      last_seen_at: Date | string
      requested_by_user_id: string | null
    }>(`
      SELECT
        id,
        kind,
        status,
        organization_id,
        expires_at,
        started_at,
        last_seen_at,
        requested_by_user_id
      FROM sf_demo_environments
      WHERE organization_id = $1
      LIMIT 1
    `, [organizationId])

    const row = result.rows[0]
    if (!row) return null

    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      organizationId: row.organization_id,
      expiresAt: iso(row.expires_at),
      startedAt: iso(row.started_at),
      lastSeenAt: iso(row.last_seen_at),
      requestedByUserId: row.requested_by_user_id,
    }
  } catch (error) {
    if (missingDemoSchema(error)) return null
    throw error
  }
}

export async function expireDemoOrganizationIfNeeded(organizationId: string) {
  try {
    const result = await getPostgresPool().query<{
      id: string
      expired: boolean
    }>(`
      WITH due AS (
        UPDATE sf_demo_environments
        SET
          status = 'expired',
          expired_at = COALESCE(expired_at, now()),
          updated_at = now()
        WHERE organization_id = $1
          AND status = 'active'
          AND expires_at <= now()
        RETURNING id, organization_id, billing_account_id
      ),
      suspended_org AS (
        UPDATE sf_organizations o
        SET status = 'suspended', updated_at = now()
        FROM due
        WHERE o.id = due.organization_id
        RETURNING o.id
      ),
      canceled_subscription AS (
        UPDATE sf_subscriptions s
        SET
          status = 'canceled',
          canceled_at = COALESCE(canceled_at, now()),
          updated_at = now(),
          metadata = COALESCE(metadata, '{}'::jsonb) || '{"expiredBy":"demo-phase-16"}'::jsonb
        FROM due
        WHERE s.billing_account_id = due.billing_account_id
          AND s.status <> 'canceled'
        RETURNING s.id
      )
      SELECT id, true AS expired FROM due
    `, [organizationId])
    return Boolean(result.rowCount)
  } catch (error) {
    if (missingDemoSchema(error)) return false
    throw error
  }
}

export async function demoOrganizationIsUsable(organizationId: string) {
  await expireDemoOrganizationIfNeeded(organizationId)
  const demo = await getDemoEnvironmentForOrganization(organizationId)
  if (!demo) return true
  return demo.status === "active" && new Date(demo.expiresAt).getTime() > Date.now()
}

export async function touchDemoEnvironment(organizationId: string) {
  try {
    await getPostgresPool().query(`
      UPDATE sf_demo_environments
      SET last_seen_at = now(), updated_at = now()
      WHERE organization_id = $1
        AND status = 'active'
        AND expires_at > now()
    `, [organizationId])
  } catch (error) {
    if (!missingDemoSchema(error)) throw error
  }
}

export async function assertDemoActionAllowed(
  organizationId: string,
  action:
    | "custom-domain"
    | "external-print"
    | "dangerous-integration",
) {
  const demo = await getDemoEnvironmentForOrganization(organizationId)
  if (!demo) return

  if (demo.status !== "active" || new Date(demo.expiresAt).getTime() <= Date.now()) {
    throw new DemoPolicyError(
      "Esta demonstração expirou. Inicie uma nova demo para continuar.",
      "demo_expired",
      410,
    )
  }

  const messages = {
    "custom-domain": "Domínio próprio fica bloqueado em ambientes de demonstração.",
    "external-print": "Impressão externa fica bloqueada em ambientes de demonstração.",
    "dangerous-integration": "Integrações externas reais ficam bloqueadas em ambientes de demonstração.",
  } as const

  throw new DemoPolicyError(messages[action])
}

export async function assertDemoSettingsPatchAllowed(
  organizationId: string,
  patch: Record<string, unknown>,
) {
  const demo = await getDemoEnvironmentForOrganization(organizationId)
  if (!demo) return

  const enablingExternalEffect =
    patch.autoPrintNewOrders === true ||
    patch.fiscalEnabled === true ||
    patch.whatsappBulkEnabled === true ||
    (typeof patch.fiscalProviderUrl === "string" && patch.fiscalProviderUrl.trim().length > 0)

  if (enablingExternalEffect) {
    throw new DemoPolicyError(
      "A demonstração não pode habilitar impressão automática, emissão fiscal ou disparos externos reais.",
      "demo_external_effect_blocked",
    )
  }
}

export function demoPolicyErrorStatus(error: unknown) {
  return error instanceof DemoPolicyError ? error.status : 400
}
