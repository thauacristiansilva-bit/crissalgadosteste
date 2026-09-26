import type { PoolClient } from "pg"
import type { Order } from "@/lib/types"
import { loyaltyEntitlementActive } from "@/lib/loyalty-db"

/** Updates and ledger entries share the order status transaction. A unique key prevents repeat credit. */
export async function applyCashbackForOrderStatusTransitionWithClient(
  client: PoolClient, organizationId: string, previousStatus: Order["status"] | null, order: Order,
) {
  if (previousStatus === order.status || !order.customer?.accountId) return
  const ready = await client.query<{ ledger: string | null }>("SELECT to_regclass('public.sf_cashback_ledger')::text AS ledger")
  if (!ready.rows[0]?.ledger) return
  const accountId = Number(order.customer.accountId)
  if (order.status === "completed" && previousStatus !== "completed") {
    if (!(await loyaltyEntitlementActive(client, organizationId))) return
    const settings = await client.query<{ enabled: boolean; percent: number }>(
      `SELECT COALESCE((settings->>'cashbackEnabled')::boolean, false) AS enabled,
              COALESCE((settings->>'cashbackPercent')::numeric, 0) AS percent
       FROM sf_organization_settings WHERE organization_id = $1`, [organizationId],
    )
    if (!settings.rows[0]?.enabled) return
    const percent = Math.max(0, Math.min(100, Number(settings.rows[0].percent)))
    const cents = Math.round(Math.max(0, order.total) * percent)
    if (!cents) return
    const exists = await client.query("SELECT 1 FROM sf_cashback_ledger WHERE organization_id = $1 AND order_id = $2 AND kind = 'earn'", [organizationId, order.id])
    if (exists.rowCount) return
    const updated = await client.query<{ cashback_cents: number }>(
      `UPDATE sf_customer_accounts SET cashback_cents = cashback_cents + $3, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND active = true RETURNING cashback_cents`, [organizationId, accountId, cents],
    )
    if (!updated.rows[0]) return
    await client.query(
      `INSERT INTO sf_cashback_ledger (organization_id, customer_id, order_id, kind, amount_cents, balance_after_cents)
       VALUES ($1, $2, $3, 'earn', $4, $5)`, [organizationId, accountId, order.id, cents, updated.rows[0].cashback_cents],
    )
  }
  if (order.status === "cancelled" && previousStatus !== "cancelled") {
    const ledger = await client.query<{ kind: string; amount_cents: number }>(
      `SELECT kind, amount_cents FROM sf_cashback_ledger WHERE organization_id = $1 AND order_id = $2`, [organizationId, order.id],
    )
    const entries = new Map(ledger.rows.map((row) => [row.kind, Number(row.amount_cents)]))
    // A used credit is returned on cancellation even if cashback was subsequently disabled.
    if (entries.has("redeem") && !entries.has("refund")) {
      const cents = -entries.get("redeem")!
      const updated = await client.query<{ cashback_cents: number }>(
        `UPDATE sf_customer_accounts SET cashback_cents = cashback_cents + $3, updated_at = now()
         WHERE organization_id = $1 AND id = $2 RETURNING cashback_cents`, [organizationId, accountId, cents],
      )
      if (updated.rows[0]) await client.query(
        `INSERT INTO sf_cashback_ledger (organization_id, customer_id, order_id, kind, amount_cents, balance_after_cents)
         VALUES ($1, $2, $3, 'refund', $4, $5)`, [organizationId, accountId, order.id, cents, updated.rows[0].cashback_cents],
      )
    }
    if (entries.has("earn") && !entries.has("reversal")) {
      const locked = await client.query<{ cashback_cents: number }>(
        `SELECT cashback_cents FROM sf_customer_accounts WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
        [organizationId, accountId],
      )
      const deducted = Math.min(Number(locked.rows[0]?.cashback_cents || 0), entries.get("earn")!)
      const updated = await client.query<{ cashback_cents: number; deducted: number }>(
        `UPDATE sf_customer_accounts SET cashback_cents = GREATEST(0, cashback_cents - $3), updated_at = now()
         WHERE organization_id = $1 AND id = $2
         RETURNING cashback_cents`, [organizationId, accountId, deducted],
      )
      if (updated.rows[0]) {
        // The balance cannot go negative if credit has already been spent elsewhere.
        if (deducted) await client.query(
          `INSERT INTO sf_cashback_ledger (organization_id, customer_id, order_id, kind, amount_cents, balance_after_cents)
           VALUES ($1, $2, $3, 'reversal', $4, $5)`, [organizationId, accountId, order.id, -deducted, updated.rows[0].cashback_cents],
        )
      }
    }
  }
}
