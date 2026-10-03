const fs = require("fs")
const path = require("path")

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const index = trimmed.indexOf("=")
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"))
loadEnvFile(path.join(process.cwd(), ".env"))

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL nao encontrada. Configure .env.local ou execute no ambiente do Railway.")
  process.exit(1)
}

const { Pool } = require("pg")
const migration = path.join(process.cwd(), "database", "migrations", "20261003_etapa12_marketing_publications.sql")
if (!fs.existsSync(migration)) {
  console.error(`Migration nao encontrada: ${migration}`)
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

;(async () => {
  try {
    console.log("Aplicando migration da Etapa 12...")
    await pool.query(fs.readFileSync(migration, "utf8"))
    const check = await pool.query("SELECT to_regclass('public.sf_marketing_publications') AS table_name")
    if (!check.rows[0]?.table_name) throw new Error("Tabela nao foi criada.")
    console.log("OK - sf_marketing_publications pronta.")
  } catch (error) {
    console.error("Falha ao aplicar migration:", error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
})()
