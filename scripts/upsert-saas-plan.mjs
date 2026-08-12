import process from "node:process"
import { randomUUID } from "node:crypto"
import pg from "pg"

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DATABASE_URL não está configurada.")

const code = (process.env.PLAN_CODE || "").trim().toLowerCase()
const name = (process.env.PLAN_NAME || "").trim()
const description = (process.env.PLAN_DESCRIPTION || "").trim()
const monthly = process.env.PLAN_MONTHLY_CENTS ? Number(process.env.PLAN_MONTHLY_CENTS) : null
const annual = process.env.PLAN_ANNUAL_CENTS ? Number(process.env.PLAN_ANNUAL_CENTS) : null
const sortOrder = Number(process.env.PLAN_SORT_ORDER || "0")
const entitlements = JSON.parse(process.env.PLAN_ENTITLEMENTS_JSON || "{}")

const keys = new Set([
  "maxOrganizations", "maxUsers", "maxProducts", "customDomain", "delivery",
  "kitchen", "financial", "loyalty", "modifiers", "inventory", "advancedReports",
])

if (!code || !name) throw new Error("PLAN_CODE e PLAN_NAME são obrigatórios.")
if ((!Number.isFinite(monthly) || monthly <= 0) && (!Number.isFinite(annual) || annual <= 0)) {
  throw new Error("Defina PLAN_MONTHLY_CENTS ou PLAN_ANNUAL_CENTS com valor maior que zero.")
}
for (const key of Object.keys(entitlements)) {
  if (!keys.has(key)) throw new Error(`Entitlement desconhecido: ${key}`)
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 })
const client = await pool.connect()
try {
  await client.query("BEGIN")
  const current = await client.query(`SELECT id FROM sf_plans WHERE lower(code) = lower($1) LIMIT 1 FOR UPDATE`, [code])
  const id = current.rows[0]?.id || randomUUID()
  if (current.rowCount) {
    await client.query(`
      UPDATE sf_plans
      SET name = $2, description = $3, currency = 'BRL', monthly_price_cents = $4,
          annual_price_cents = $5, active = true, internal = false, checkout_enabled = true,
          sort_order = $6, updated_at = now()
      WHERE id = $1
    `, [id, name, description, Number.isFinite(monthly) && monthly > 0 ? Math.round(monthly) : null, Number.isFinite(annual) && annual > 0 ? Math.round(annual) : null, sortOrder])
  } else {
    await client.query(`
      INSERT INTO sf_plans (
        id, code, name, description, currency, monthly_price_cents, annual_price_cents,
        active, internal, checkout_enabled, sort_order, metadata
      ) VALUES ($1, $2, $3, $4, 'BRL', $5, $6, true, false, true, $7, '{"source":"phase-14-cli"}'::jsonb)
    `, [id, code, name, description, Number.isFinite(monthly) && monthly > 0 ? Math.round(monthly) : null, Number.isFinite(annual) && annual > 0 ? Math.round(annual) : null, sortOrder])
  }

  for (const key of keys) {
    const value = Object.prototype.hasOwnProperty.call(entitlements, key) ? entitlements[key] : (key.startsWith("max") ? 0 : false)
    await client.query(`
      INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (plan_id, entitlement_key)
      DO UPDATE SET entitlement_value = EXCLUDED.entitlement_value, updated_at = now()
    `, [id, key, JSON.stringify(value)])
  }

  await client.query("COMMIT")
  console.log(`Plano ${code} publicado com sucesso.`)
  console.log(`Mensal: ${monthly ?? "-"} centavos | Anual: ${annual ?? "-"} centavos`)
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
