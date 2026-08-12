import {
  createHash,
  randomBytes,
  randomUUID,
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
  process.argv[2] ||
  process.env.ADMIN_EMAIL ||
  ""
)
  .trim()
  .toLowerCase()

if (!email) {
  console.error(
    "Uso: node scripts/create-password-reset-link.mjs email@exemplo.com",
  )
  process.exit(1)
}

const token =
  randomBytes(32).toString(
    "base64url",
  )

const tokenHash =
  createHash("sha256")
    .update(token)
    .digest("hex")

const pool = new Pool({
  connectionString:
    databaseUrl,
  max: 2,
  connectionTimeoutMillis:
    10000,
})

async function main() {
  const client =
    await pool.connect()

  try {
    const result =
      await client.query(
        `
          SELECT id, email, status
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
        "Usuário não encontrado.",
      )
    }

    if (
      user.status === "blocked"
    ) {
      throw new Error(
        "Usuário bloqueado. Revise o acesso antes de redefinir a senha.",
      )
    }

    await client.query(
      "BEGIN",
    )

    await client.query(
      `
        UPDATE sf_auth_tokens
        SET used_at =
          COALESCE(used_at, now())
        WHERE user_id = $1
          AND purpose =
            'password_reset'
          AND used_at IS NULL
      `,
      [user.id],
    )

    const expiresAt =
      new Date(
        Date.now() +
          30 * 60 * 1000,
      )

    await client.query(
      `
        INSERT INTO sf_auth_tokens (
          id,
          user_id,
          organization_id,
          purpose,
          token_hash,
          expires_at,
          created_by_user_id,
          metadata
        )
        VALUES (
          $1,
          $2,
          NULL,
          'password_reset',
          $3,
          $4,
          NULL,
          $5::jsonb
        )
      `,
      [
        randomUUID(),
        user.id,
        tokenHash,
        expiresAt,
        JSON.stringify({
          source:
            "railway-console-recovery",
        }),
      ],
    )

    await client.query(
      "COMMIT",
    )

    const publicDomain =
      (
        process.env
          .RAILWAY_PUBLIC_DOMAIN ||
        ""
      ).trim()

    const path =
      `/recuperar-senha/${encodeURIComponent(
        token,
      )}`

    console.log("")
    console.log(
      "SaborFlow - recuperação administrativa criada.",
    )
    console.log(
      `Usuário: ${user.email}`,
    )
    console.log(
      `Expira: ${expiresAt.toISOString()}`,
    )
    console.log("")
    console.log(
      "LINK DE USO ÚNICO (trate como senha):",
    )

    if (publicDomain) {
      console.log(
        `https://${publicDomain}${path}`,
      )
    } else {
      console.log(path)
    }

    console.log("")
    console.log(
      "O PostgreSQL armazenou somente o hash do token.",
    )
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK",
      )
    } catch {
      // nada
    }

    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(
    "Falha ao gerar recuperação:",
  )
  console.error(error)
  process.exit(1)
})
