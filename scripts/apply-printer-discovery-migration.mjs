import fs from "node:fs/promises"
import { Client } from "pg"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.")
const sql = await fs.readFile(new URL("../database/migrations/043_print_agent_printers.sql", import.meta.url), "utf8")
const client = new Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query(sql)
  console.log("Migração 043 aplicada. Impressoras podem ser exibidas no painel.")
} finally { await client.end() }
