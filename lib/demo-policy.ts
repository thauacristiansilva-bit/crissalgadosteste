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
  basicMode: boolean
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
      basic_mode: boolean
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
        requested_by_user_id,
        COALESCE(metadata ->> 'mode', '') = 'basic' AS basic_mode
      FROM sf_demo_environments
      WHERE organization_id = $1
      LIMIT 1
    `, [organizationId])

    const row = result.rows[0]
    if (!row || row.status === "closed") return null

    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      organizationId: row.organization_id,
      expiresAt: iso(row.expires_at),
      startedAt: iso(row.started_at),
      lastSeenAt: iso(row.last_seen_at),
      basicMode: row.basic_mode === true,
      requestedByUserId: row.requested_by_user_id,
    }
  } catch (error) {
    if (missingDemoSchema(error)) return null
    throw error
  }
}

export async function expireDemoOrganizationIfNeeded(organizationId: string) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const due = await client.query<{
      id: string
      billing_account_id: string
      expires_at: Date | string
      basic_mode: boolean
    }>(`
      SELECT
        id,
        billing_account_id,
        expires_at,
        COALESCE(metadata ->> 'mode', '') = 'basic' AS basic_mode
      FROM sf_demo_environments
      WHERE organization_id = $1
        AND status = 'active'
        AND expires_at <= now()
      LIMIT 1
      FOR UPDATE
    `, [organizationId])
    const demo = due.rows[0]
    if (!demo) {
      await client.query("COMMIT")
      return false
    }

    // Um teste básico pode ter um plano comercial já autorizado e agendado
    // para começar exatamente depois dos 7 dias gratuitos.
    const scheduled = demo.basic_mode
      ? await client.query<{
          id: string
          billing_cycle: "monthly" | "semiannual" | "annual" | null
        }>(`
          SELECT s.id, s.billing_cycle
          FROM sf_subscriptions s
          INNER JOIN sf_plans p ON p.id = s.plan_id
          WHERE s.billing_account_id = $1
            AND p.internal = false
            AND s.status = 'pending'
            AND lower(COALESCE(s.provider_status, '')) IN ('authorized', 'active', 'received', 'confirmed', 'payment_received', 'payment_confirmed')
            AND COALESCE(s.metadata ->> 'scheduledActivationAt', '') <> ''
            AND (s.metadata ->> 'scheduledActivationAt')::timestamptz <= now()
          ORDER BY s.created_at DESC
          LIMIT 1
          FOR UPDATE OF s
        `, [demo.billing_account_id])
      : { rows: [] as Array<{ id: string; billing_cycle: "monthly" | "semiannual" | "annual" | null }> }

    const paid = scheduled.rows[0]
    if (paid) {
      const startsAt = new Date(demo.expires_at)
      const endsAt = new Date(startsAt)
      if (paid.billing_cycle === "annual") endsAt.setFullYear(endsAt.getFullYear() + 1)
      else if (paid.billing_cycle === "semiannual") endsAt.setMonth(endsAt.getMonth() + 6)
      else endsAt.setMonth(endsAt.getMonth() + 1)

      await client.query(`
        UPDATE sf_subscriptions s
        SET status = 'canceled',
            canceled_at = COALESCE(canceled_at, now()),
            metadata = COALESCE(metadata, '{}'::jsonb) || '{"completedTrial":true}'::jsonb,
            updated_at = now()
        FROM sf_plans p
        WHERE s.plan_id = p.id
          AND s.billing_account_id = $1
          AND p.internal = true
          AND s.status <> 'canceled'
      `, [demo.billing_account_id])

      await client.query(`
        UPDATE sf_subscriptions
        SET status = 'active',
            activated_at = COALESCE(activated_at, now()),
            current_period_start = $2,
            current_period_end = $3,
            metadata = COALESCE(metadata, '{}'::jsonb) || '{"activatedAfterTrial":true}'::jsonb,
            updated_at = now()
        WHERE id = $1
      `, [paid.id, startsAt, endsAt])

      await client.query(`
        UPDATE sf_demo_environments
        SET status = 'closed',
            expired_at = COALESCE(expired_at, now()),
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        WHERE id = $1
      `, [demo.id, JSON.stringify({ convertedToPaid: true, paidSubscriptionId: paid.id })])

      await client.query(`
        UPDATE sf_organizations
        SET status = 'active', updated_at = now()
        WHERE id = $1
      `, [organizationId])

      await client.query(`
        UPDATE sf_billing_accounts
        SET entitlement_overrides = '{}'::jsonb,
            metadata = (COALESCE(metadata, '{}'::jsonb) - 'basicTrial' - 'basicTrialEnvironmentId') || '{"convertedFromTrial":true}'::jsonb,
            onboarding_unlocked_at = COALESCE(onboarding_unlocked_at, now()),
            updated_at = now()
        WHERE id = $1
      `, [demo.billing_account_id])

      await client.query("COMMIT")
      return true
    }

    await client.query(`
      UPDATE sf_demo_environments
      SET status = 'expired',
          expired_at = COALESCE(expired_at, now()),
          updated_at = now()
      WHERE id = $1
    `, [demo.id])

    await client.query(`
      UPDATE sf_organizations
      SET status = 'suspended', updated_at = now()
      WHERE id = $1
    `, [organizationId])

    // Ao terminar o teste, cancelamos apenas a assinatura interna do trial.
    // Checkouts comerciais pendentes continuam válidos para o cliente concluir.
    await client.query(`
      UPDATE sf_subscriptions s
      SET status = 'canceled',
          canceled_at = COALESCE(canceled_at, now()),
          updated_at = now(),
          metadata = COALESCE(metadata, '{}'::jsonb) || '{"expiredBy":"basic-trial"}'::jsonb
      FROM sf_plans p
      WHERE s.plan_id = p.id
        AND s.billing_account_id = $1
        AND p.internal = true
        AND s.status <> 'canceled'
    `, [demo.billing_account_id])

    await client.query("COMMIT")
    return true
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    if (missingDemoSchema(error)) return false
    throw error
  } finally {
    client.release()
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

  if (demo.basicMode && ["chatbotEnabled", "aiStorefrontChatEnabled", "aiStorefrontTextEnabled", "aiStorefrontAudioEnabled", "aiFloatingButtonEnabled", "aiPdvEnabled", "aiPdvTextEnabled", "aiPdvAudioEnabled"].some(key => patch[key] === true)) {
    throw new DemoPolicyError("O teste grátis básico não inclui IA.", "basic_trial_ai_blocked")
  }

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
