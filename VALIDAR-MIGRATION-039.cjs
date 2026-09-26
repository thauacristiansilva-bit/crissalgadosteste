const { Client } = require("pg")

async function main() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL nao encontrada.")
  }

  const client = new Client({
    connectionString,
    ...(process.env.DATABASE_PUBLIC_URL
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  })

  await client.connect()

  try {
    const result = await client.query(`
      SELECT
        to_regclass('public.sf_product_promotions') AS table_name,
        COUNT(*)::int AS promotions
      FROM sf_product_promotions
    `)

    console.log(result.rows[0])
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
