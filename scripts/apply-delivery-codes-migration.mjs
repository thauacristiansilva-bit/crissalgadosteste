import fs from "node:fs/promises"
import { Client } from "pg"

if (!process.env.DATABASE_URL) throw new Error("Execute no console do serviço SaborFlow no Railway, onde DATABASE_URL já está configurada.")
const sql = await fs.readFile(new URL("../database/migrations/045_admin_delivery_codes.sql", import.meta.url), "utf8")
const client = new Client({ connectionString:process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query(sql)
  console.log("Cadastro de contatos e códigos de acesso instalado. Ative o envio nas variáveis do serviço.")
} finally { await client.end() }
