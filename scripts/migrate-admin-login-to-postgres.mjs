import {
  randomBytes,
  scryptSync,
} from "node:crypto"
import process from "node:process"
import pg from "pg"

const { Pool } = pg

const databaseUrl =
  process.env.DATABASE_URL

if (!databaseUrl) {
  console.error(
    "ERRO: DATABASE_URL não está configurada.",
  )
  process.exit(1)
}

const email = (
  process.env.ADMIN_EMAIL || ""
)
  .trim()
  .toLowerCase()

const password =
  process.env.ADMIN_PASSWORD || ""

if (!email) {
  console.error(
    "ERRO: ADMIN_EMAIL não está configurado.",
  )
  process.exit(1)
}

if (!password) {
  console.error(
    "ERRO: ADMIN_PASSWORD precisa estar configurada para promover o login atual ao PostgreSQL.",
  )
  process.exit(1)
}

if (password.length < 8) {
  console.error(
    "ERRO: a senha administrativa precisa ter pelo menos 8 caracteres antes da promoção ao PostgreSQL.",
  )
  process.exit(1)
}

const force =
  process.argv.includes("--force")

function hashPassword(value) {
  const salt = randomBytes(
    16,
  ).toString("hex")

  const digest = scryptSync(
    value,
    salt,
    32,
  ).toString("hex")

  return `scrypt$v1$${salt}$${digest}`
}

const pool = new Pool({
  connectionString:
    databaseUrl,
  max: 2,
  connectionTimeoutMillis:
    10_000,
})

async function main() {
  const client =
    await pool.connect()

  try {
    const result =
      await client.query(
        `
          SELECT
            id,
            email,
            password_hash,
            status
          FROM sf_users
          WHERE lower(email) = lower($1)
          LIMIT 1
        `,
        [email],
      )

    const user =
      result.rows[0]

    if (!user) {
      throw new Error(
        "O ADMIN_EMAIL ainda não existe em sf_users.",
      )
    }

    if (
      user.status !== "active"
    ) {
      throw new Error(
        "O usuário administrativo não está ativo.",
      )
    }

    if (
      user.password_hash &&
      !force
    ) {
      console.log("")
      console.log(
        "SaborFlow - login PostgreSQL já está preparado.",
      )
      console.log(
        `Usuário: ${user.email}`,
      )
      console.log(
        "Nada foi alterado. Não use --force sem necessidade.",
      )
      return
    }

    await client.query(
      `
        UPDATE sf_users
        SET
          password_hash = $2,
          password_updated_at = now(),
          updated_at = now()
        WHERE id = $1
      `,
      [
        user.id,
        hashPassword(password),
      ],
    )

    console.log("")
    console.log(
      "SaborFlow - login administrativo promovido ao PostgreSQL com sucesso.",
    )
    console.log(
      `Usuário: ${user.email}`,
    )
    console.log(
      "A senha não foi exibida.",
    )
    console.log("")
    console.log(
      "Faça logout e login novamente. Depois confira /api/admin/multiempresa-health.",
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(
    "Falha ao promover o login administrativo:",
  )
  console.error(error)
  process.exit(1)
})
