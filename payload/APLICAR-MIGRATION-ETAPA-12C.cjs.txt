const fs = require("fs")
const { Client } = require("pg")

async function main() {
  const sql = fs.readFileSync(
    "database/migrations/ETAPA_12C_meta_instagram_auto_publish.sql",
    "utf8",
  )

  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_PUBLIC_URL/DATABASE_URL nao encontrada.",
    )
  }

  const usingPublic =
    Boolean(process.env.DATABASE_PUBLIC_URL)

  const client = new Client({
    connectionString,
    ...(usingPublic
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {}),
  })

  await client.connect()

  try {
    console.log("Aplicando migration ETAPA 12C...")
    await client.query(sql)
    console.log("")
    console.log("MIGRATION ETAPA 12C APLICADA COM SUCESSO.")
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("")
  console.error("ERRO NA MIGRATION ETAPA 12C:")
  console.error(error)
  process.exit(1)
})
