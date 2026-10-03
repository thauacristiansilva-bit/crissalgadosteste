import type { PoolClient } from "pg"
import type { Order } from "@/lib/types"

export const CASHBACK_POINTS_PER_REAL = 100

export function cashbackAmountFromPoints(points: number) {
  return Number((Math.max(0, Number(points || 0)) / CASHBACK_POINTS_PER_REAL).toFixed(2))
}

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

export async function loyaltyEntitlementActive(client: PoolClient, organizationId: string) {
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
    // Mantemos o campo legado no banco. Como 100 pontos = R$ 1,00,
    // "5 pontos por real" equivale a 5% de cashback.
    pointsPerReal: Math.max(0, Number(result.rows[0]?.points_per_real || 0)),
  }
}

export async function getCashbackCheckoutStateWithClient(
  client: PoolClient,
  organizationId: string,
  accountId: number,
) {
  if (!(await loyaltyLedgerReady(client))) {
    return { enabled: false, balancePoints: 0, balanceAmount: 0, cashbackPercent: 0 }
  }
  if (!(await loyaltyEntitlementActive(client, organizationId))) {
    return { enabled: false, balancePoints: 0, balanceAmount: 0, cashbackPercent: 0 }
  }
  const settings = await loyaltySettings(client, organizationId)
  if (!settings.enabled) {
    return { enabled: false, balancePoints: 0, balanceAmount: 0, cashbackPercent: 0 }
  }
  const account = await client.query<{ loyalty_points: number }>(
    `
      SELECT loyalty_points
      FROM sf_customer_accounts
      WHERE organization_id = $1
        AND id = $2
        AND active = true
      LIMIT 1
    `,
    [organizationId, accountId],
  )
  const balancePoints = Math.max(0, Number(account.rows[0]?.loyalty_points || 0))
  return {
    enabled: true,
    balancePoints,
    balanceAmount: cashbackAmountFromPoints(balancePoints),
    cashbackPercent: settings.pointsPerReal,
  }
}

/**
 * Debita cashback no mesmo transaction do pedido. O servidor ignora qualquer
 * valor de desconto vindo do navegador e calcula o máximo permitido pelo saldo
 * real e pelo valor elegível dos produtos após cupom.
 */
export async function redeemCashbackForOrderWithClient(
  client: PoolClient,
  organizationId: string,
  accountId: number,
  orderId: number,
  eligibleAmount: number,
) {
  if (!(await loyaltyLedgerReady(client))) return { points: 0, amount: 0, balanceAfter: 0 }
  if (!(await loyaltyEntitlementActive(client, organizationId))) return { points: 0, amount: 0, balanceAfter: 0 }
  const settings = await loyaltySettings(client, organizationId)
  if (!settings.enabled) return { points: 0, amount: 0, balanceAfter: 0 }

  const locked = await client.query<{ loyalty_points: number }>(
    `
      SELECT loyalty_points
      FROM sf_customer_accounts
      WHERE organization_id = $1
        AND id = $2
        AND active = true
      FOR UPDATE
    `,
    [organizationId, accountId],
  )
  if (!locked.rows[0]) return { points: 0, amount: 0, balanceAfter: 0 }

  const balance = Math.max(0, Number(locked.rows[0].loyalty_points || 0))
  const maxEligiblePoints = Math.max(0, Math.floor(Number(eligibleAmount || 0) * CASHBACK_POINTS_PER_REAL + 0.00001))
  const points = Math.min(balance, maxEligiblePoints)
  if (!points) return { points: 0, amount: 0, balanceAfter: balance }

  const existing = await client.query<{ points: number; balance_after: number }>(
    `
      SELECT points, balance_after
      FROM sf_loyalty_ledger
      WHERE organization_id = $1
        AND order_id = $2
        AND kind = 'redeem'
      LIMIT 1
    `,
    [organizationId, orderId],
  )
  if (existing.rows[0]) {
    const redeemed = Math.abs(Number(existing.rows[0].points || 0))
    return {
      points: redeemed,
      amount: cashbackAmountFromPoints(redeemed),
      balanceAfter: Math.max(0, Number(existing.rows[0].balance_after || 0)),
    }
  }

  const updated = await client.query<{ loyalty_points: number }>(
    `
      UPDATE sf_customer_accounts
      SET loyalty_points = GREATEST(0, loyalty_points - $3),
          updated_at = now()
      WHERE organization_id = $1
        AND id = $2
        AND active = true
      RETURNING loyalty_points
    `,
    [organizationId, accountId, points],
  )
  const balanceAfter = Math.max(0, Number(updated.rows[0]?.loyalty_points || 0))

  await client.query(
    `
      INSERT INTO sf_loyalty_ledger (
        organization_id, customer_id, order_id, kind,
        points, balance_after, reason
      )
      VALUES ($1, $2, $3, 'redeem', $4, $5, $6)
      ON CONFLICT DO NOTHING
    `,
    [organizationId, accountId, orderId, -points, balanceAfter, `Cashback usado no pedido #${orderId}`],
  )

  return { points, amount: cashbackAmountFromPoints(points), balanceAfter }
}

async function refundRedeemedCashbackWithClient(
  client: PoolClient,
  organizationId: string,
  accountId: number,
  order: Order,
) {
  const redemption = await client.query<{
    cashback_redeemed_points: number
    cashback_refunded_at: Date | string | null
  }>(
    `
      SELECT cashback_redeemed_points, cashback_refunded_at
      FROM sf_orders
      WHERE organization_id = $1
        AND id = $2
      FOR UPDATE
    `,
    [organizationId, order.id],
  )
  const row = redemption.rows[0]
  const points = Math.max(0, Number(row?.cashback_redeemed_points || 0))
  if (!points || row?.cashback_refunded_at) return

  const updated = await client.query<{ loyalty_points: number }>(
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
  const balanceAfter = Math.max(0, Number(updated.rows[0]?.loyalty_points || 0))
  if (!updated.rows[0]) return

  await client.query(
    `
      INSERT INTO sf_loyalty_ledger (
        organization_id, customer_id, order_id, kind,
        points, balance_after, reason
      )
      VALUES ($1, $2, $3, 'adjust', $4, $5, $6)
    `,
    [organizationId, accountId, order.id, points, balanceAfter, `Cashback devolvido pelo cancelamento do pedido ${order.code || `#${order.id}`}`],
  )

  await client.query(
    `
      UPDATE sf_orders
      SET cashback_refunded_at = now()
      WHERE organization_id = $1
        AND id = $2
        AND cashback_refunded_at IS NULL
    `,
    [organizationId, order.id],
  )
}

/**
 * Pontos/cashback são creditados quando o pedido passa para concluído.
 * No cancelamento, o ganho é revertido e qualquer cashback usado no pedido
 * volta para a conta do cliente. Tudo acontece na mesma transação do pedido.
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
    if (cutoverAt && Number.isFinite(orderCreatedAt) && orderCreatedAt < cutoverAt) return

    if (!(await loyaltyEntitlementActive(client, organizationId))) return
    const settings = await loyaltySettings(client, organizationId)
    if (!settings.enabled || settings.pointsPerReal <= 0) return

    const cashbackResult = await client.query<{ cashback_discount: string | number }>(
      `SELECT cashback_discount FROM sf_orders WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [organizationId, order.id],
    )
    const cashbackDiscount = Math.max(0, Number(cashbackResult.rows[0]?.cashback_discount || 0))
    const eligibleProductAmount = Math.max(
      0,
      Number(order.subtotal || 0) - Number(order.discount || 0) - cashbackDiscount,
    )
    const points = Math.max(0, Math.floor(eligibleProductAmount * settings.pointsPerReal))
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
      [organizationId, accountId, order.id, points, balance, `Cashback do pedido ${order.code || `#${order.id}`} concluído`],
    )
    return
  }

  if (order.status === "cancelled") {
    // Primeiro devolvemos qualquer cashback que o cliente usou no pedido.
    await refundRedeemedCashbackWithClient(client, organizationId, accountId, order)

    // Se o pedido já havia sido concluído, removemos também o cashback ganho nele.
    if (previousStatus !== "completed") return

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
      [organizationId, accountId, order.id, -deduction, balance, `Estorno do cashback ganho no pedido ${order.code || `#${order.id}`}`],
    )
  }
}
