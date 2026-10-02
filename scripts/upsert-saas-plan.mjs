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
const semiannual = process.env.PLAN_SEMIANNUAL_CENTS ? Number(process.env.PLAN_SEMIANNUAL_CENTS) : null
const annual = process.env.PLAN_ANNUAL_CENTS ? Number(process.env.PLAN_ANNUAL_CENTS) : null
const sortOrder = Number(process.env.PLAN_SORT_ORDER || "0")
const entitlements = JSON.parse(process.env.PLAN_ENTITLEMENTS_JSON || "{}")

const keys = new Set([
  "maxOrganizations", "maxUsers", "maxProducts", "customDomain", "delivery",
  "kitchen", "financial", "loyalty", "modifiers", "inventory", "advancedReports", "integrations", "aiSetup",
])

if (!code || !name) throw new Error("PLAN_CODE e PLAN_NAME são obrigatórios.")
if (
  (!Number.isFinite(monthly) || monthly <= 0) &&
  (!Number.isFinite(semiannual) || semiannual <= 0) &&
  (!Number.isFinite(annual) || annual <= 0)
) {
  throw new Error("Defina PLAN_MONTHLY_CENTS, PLAN_SEMIANNUAL_CENTS ou PLAN_ANNUAL_CENTS com valor maior que zero.")
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
          semiannual_price_cents = $5, annual_price_cents = $6,
          active = true, internal = false, checkout_enabled = true,
          sort_order = $7, updated_at = now()
      WHERE id = $1
    `, [id, name, description, monthly, semiannual, annual, sortOrder])
  } else {
    await client.query(`
      INSERT INTO sf_plans (
        id, code, name, description, currency, monthly_price_cents,
        semiannual_price_cents, annual_price_cents,
        active, internal, checkout_enabled, sort_order
      ) VALUES ($1,$2,$3,$4,'BRL',$5,$6,$7,true,false,true,$8)
    `, [id, code, name, description, monthly, semiannual, annual, sortOrder])
  }

  for (const [key, value] of Object.entries(entitlements)) {
    await client.query(`
      INSERT INTO sf_plan_entitlements (plan_id, entitlement_key, entitlement_value)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (plan_id, entitlement_key)
      DO UPDATE SET entitlement_value = EXCLUDED.entitlement_value, updated_at = now()
    `, [id, key, JSON.stringify(value)])
  }

  await client.query("COMMIT")
  console.log(JSON.stringify({ ok: true, id, code, monthly, semiannual, annual, entitlements }, null, 2))
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
