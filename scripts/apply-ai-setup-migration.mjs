import fs from "node:fs/promises"
import { Client } from "pg"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.")
const sql = await fs.readFile(new URL("../database/migrations/041_ai_setup_recommendations.sql", import.meta.url), "utf8")
const client = new Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query(sql)
  console.log("Migração 041 aplicada. As sugestões de produtos estão disponíveis.")
} finally { await client.end() }
