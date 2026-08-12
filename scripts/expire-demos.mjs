import process from "node:process"
import pg from "pg"

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não configurada.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 10000 })

async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const due = await client.query(`
      UPDATE sf_demo_environments
      SET status = 'expired', expired_at = COALESCE(expired_at, now()), updated_at = now()
      WHERE status = 'active' AND expires_at <= now()
      RETURNING organization_id, billing_account_id
    `)
    for (const row of due.rows) {
      await client.query(`UPDATE sf_organizations SET status = 'suspended', updated_at = now() WHERE id = $1`, [row.organization_id])
      await client.query(`
        UPDATE sf_subscriptions
        SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
        WHERE billing_account_id = $1 AND status <> 'canceled'
      `, [row.billing_account_id])
    }
    await client.query("COMMIT")
    console.log(`Demos expiradas nesta execução: ${due.rowCount || 0}`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Falha ao expirar demos:")
  console.error(error)
  process.exit(1)
})
