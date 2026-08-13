import type { PoolClient } from "pg"
import type { Order } from "@/lib/types"

async function loyaltyLedgerReady(client: PoolClient) {
  const result = await client.query<{ ledger: string | null }>(
    "SELECT to_regclass('public.sf_loyalty_ledger')::text AS ledger",
  )
  return Boolean(result.rows[0]?.ledger)
}

async function loyaltyCutoverAt(client: PoolClient) {
  const result = await client.query<{ applied_at: Date | string | null }>(
    `
      SELECT applied_at
      FROM sf_schema_migrations
      WHERE version = '020_crm_loyalty_marketing'
      LIMIT 1
    `,
  )
  const value = result.rows[0]?.applied_at
  return value ? new Date(value).getTime() : null
}

async function loyaltyEntitlementActive(client: PoolClient, organizationId: string) {
  const billing = await client.query<{
    account_status: string
    subscription_status: string | null
    plan_id: string | null
    entitlement_overrides: Record<string, unknown> | null
  }>(
    `
      SELECT
        ba.status AS account_status,
        s.status AS subscription_status,
        s.plan_id,
        ba.entitlement_overrides
      FROM sf_organizations o
      INNER JOIN sf_billing_accounts ba ON ba.id = o.billing_account_id
      LEFT JOIN LATERAL (
        SELECT current_subscription.*
        FROM sf_subscriptions current_subscription
        WHERE current_subscription.billing_account_id = ba.id
          AND current_subscription.status <> 'canceled'
        ORDER BY
          CASE current_subscription.status
            WHEN 'active' THEN 1
            WHEN 'trialing' THEN 2
            WHEN 'past_due' THEN 3
            WHEN 'suspended' THEN 4
            WHEN 'pending' THEN 5
            ELSE 6
          END,
          current_subscription.created_at DESC
        LIMIT 1
      ) s ON true
      WHERE o.id = $1
      LIMIT 1
    `,
    [organizationId],
  )

  const row = billing.rows[0]
  if (!row || row.account_status !== "active" || !["active", "trialing"].includes(row.subscription_status || "")) {
    return false
  }

  if (Object.prototype.hasOwnProperty.call(row.entitlement_overrides || {}, "loyalty")) {
    return row.entitlement_overrides?.loyalty === true
  }
  if (!row.plan_id) return false

  const entitlement = await client.query<{ entitlement_value: unknown }>(
    `
      SELECT entitlement_value
      FROM sf_plan_entitlements
      WHERE plan_id = $1
        AND entitlement_key = 'loyalty'
      LIMIT 1
    `,
    [row.plan_id],
  )
  return entitlement.rows[0]?.entitlement_value === true
}

async function loyaltySettings(client: PoolClient, organizationId: string) {
  const result = await client.query<{
    enabled: boolean
    points_per_real: string | number
  }>(
    `
      SELECT
        COALESCE((settings ->> 'loyaltyEnabled')::boolean, false) AS enabled,
        COALESCE(NULLIF(settings ->> 'loyaltyPointsPerReal', '')::numeric, 0) AS points_per_real
      FROM sf_organization_settings
      WHERE organization_id = $1
      LIMIT 1
    `,
    [organizationId],
  )

  return {
    enabled: Boolean(result.rows[0]?.enabled),
    pointsPerReal: Math.max(0, Number(result.rows[0]?.points_per_real || 0)),
  }
}

/**
 * FASE 21: pontos só são efetivamente creditados quando o pedido passa para
 * concluído. A função roda na mesma transação do pedido e é idempotente por
 * (organization_id, order_id, kind).
 *
 * Antes da migration 020 existir ela simplesmente não interfere na operação,
 * permitindo deploy do código antes da execução da migration.
 */
export async function applyLoyaltyForOrderStatusTransitionWithClient(
  client: PoolClient,
  organizationId: string,
  previousStatus: Order["status"] | null,
  order: Order,
) {
  if (!previousStatus || previousStatus === order.status) return
  if (!(await loyaltyLedgerReady(client))) return

  const accountId = Number(order.customer?.accountId || 0)
  if (!Number.isInteger(accountId) || accountId <= 0) return

  if (previousStatus !== "completed" && order.status === "completed") {
    const cutoverAt = await loyaltyCutoverAt(client)
    const orderCreatedAt = new Date(order.createdAt).getTime()
    if (cutoverAt && Number.isFinite(orderCreatedAt) && orderCreatedAt < cutoverAt) {
      // Pedidos anteriores à migration já receberam pontos no checkout legado.
      // Não creditamos novamente ao serem concluídos após a mudança de regra.
      return
    }

    if (!(await loyaltyEntitlementActive(client, organizationId))) return
    const settings = await loyaltySettings(client, organizationId)
    if (!settings.enabled || settings.pointsPerReal <= 0) return

    const points = Math.max(0, Math.floor(Number(order.total || 0) * settings.pointsPerReal))
    if (!points) return

    const existing = await client.query(
      `
        SELECT 1
        FROM sf_loyalty_ledger
        WHERE organization_id = $1
          AND order_id = $2
          AND kind = 'earn'
        LIMIT 1
      `,
      [organizationId, order.id],
    )
    if (existing.rowCount) return

    const account = await client.query<{ loyalty_points: number }>(
      `
        UPDATE sf_customer_accounts
        SET loyalty_points = loyalty_points + $3,
            updated_at = now()
        WHERE organization_id = $1
          AND id = $2
          AND active = true
        RETURNING loyalty_points
      `,
      [organizationId, accountId, points],
    )
    const balance = Number(account.rows[0]?.loyalty_points)
    if (!Number.isFinite(balance)) return

    await client.query(
      `
        INSERT INTO sf_loyalty_ledger (
          organization_id, customer_id, order_id, kind,
          points, balance_after, reason
        )
        VALUES ($1, $2, $3, 'earn', $4, $5, $6)
        ON CONFLICT DO NOTHING
      `,
      [organizationId, accountId, order.id, points, balance, `Pedido ${order.code || `#${order.id}`} concluído`],
    )
    return
  }

  if (previousStatus === "completed" && order.status === "cancelled") {
    const earned = await client.query<{ points: number }>(
      `
        SELECT points
        FROM sf_loyalty_ledger
        WHERE organization_id = $1
          AND order_id = $2
          AND kind = 'earn'
        LIMIT 1
      `,
      [organizationId, order.id],
    )
    const earnedPoints = Math.max(0, Number(earned.rows[0]?.points || 0))
    if (!earnedPoints) return

    const reversed = await client.query(
      `
        SELECT 1
        FROM sf_loyalty_ledger
        WHERE organization_id = $1
          AND order_id = $2
          AND kind = 'reversal'
        LIMIT 1
      `,
      [organizationId, order.id],
    )
    if (reversed.rowCount) return

    const locked = await client.query<{ loyalty_points: number }>(
      `
        SELECT loyalty_points
        FROM sf_customer_accounts
        WHERE organization_id = $1
          AND id = $2
        FOR UPDATE
      `,
      [organizationId, accountId],
    )
    const currentBalance = Math.max(0, Number(locked.rows[0]?.loyalty_points || 0))
    const deduction = Math.min(currentBalance, earnedPoints)
    if (!deduction) return

    const updated = await client.query<{ loyalty_points: number }>(
      `
        UPDATE sf_customer_accounts
        SET loyalty_points = GREATEST(0, loyalty_points - $3),
            updated_at = now()
        WHERE organization_id = $1
          AND id = $2
        RETURNING loyalty_points
      `,
      [organizationId, accountId, deduction],
    )
    const balance = Math.max(0, Number(updated.rows[0]?.loyalty_points || 0))

    await client.query(
      `
        INSERT INTO sf_loyalty_ledger (
          organization_id, customer_id, order_id, kind,
          points, balance_after, reason
        )
        VALUES ($1, $2, $3, 'reversal', $4, $5, $6)
        ON CONFLICT DO NOTHING
      `,
      [organizationId, accountId, order.id, -deduction, balance, `Estorno do pedido ${order.code || `#${order.id}`}`],
    )
  }
}
