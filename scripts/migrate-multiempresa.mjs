import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import pg from "pg"

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não está configurada neste terminal.")
  console.error("No Railway ela já existe. Para rodar localmente, use uma URL PostgreSQL de desenvolvimento.")
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10000,
})

const migrationsDir = path.join(process.cwd(), "database", "migrations")

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sf_schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function main() {
  const client = await pool.connect()

  try {
    console.log("Conectando ao PostgreSQL...")
    await client.query("SELECT 1")
    console.log("PostgreSQL conectado.")

    await ensureMigrationTable(client)

    const files = (await fs.readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort()

    for (const file of files) {
      const version = file.replace(/\.sql$/i, "")
      const exists = await client.query(
        "SELECT 1 FROM sf_schema_migrations WHERE version = $1",
        [version],
      )

      if (exists.rowCount) {
        console.log(`SKIP ${version} - já aplicada`)
        continue
      }

      console.log(`APLICANDO ${version}...`)
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8")

      await client.query("BEGIN")
      try {
        // A migration possui BEGIN/COMMIT para também poder ser executada
        // manualmente. Removemos essas instruções quando o runner controla
        // a transação.
        const cleanSql = sql
          .replace(/^\s*BEGIN;\s*/i, "")
          .replace(/\s*COMMIT;\s*$/i, "")

        await client.query(cleanSql)
        await client.query(
          "INSERT INTO sf_schema_migrations (version) VALUES ($1)",
          [version],
        )
        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }

      console.log(`OK ${version}`)
    }

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'sf_%'
      ORDER BY table_name
    `)

    console.log("")
    console.log("Estrutura SaborFlow encontrada:")
    for (const row of result.rows) {
      console.log(`- ${row.table_name}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Falha na migration:")
  console.error(error)
  process.exit(1)
})
