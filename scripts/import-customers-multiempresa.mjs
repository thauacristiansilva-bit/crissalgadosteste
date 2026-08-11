import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { randomUUID } from "node:crypto"
import pg from "pg"

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não está configurada.")
  process.exit(1)
}

const adminEmail = (process.env.ADMIN_EMAIL || "")
  .trim()
  .toLowerCase()

if (!adminEmail) {
  console.error("ERRO: ADMIN_EMAIL não está configurado.")
  process.exit(1)
}

const force = process.argv.includes("--force")

const dataFile =
  process.env.DATA_FILE ||
  path.join(process.cwd(), "data", "store.json")

const seedFile =
  path.join(process.cwd(), "data", "store.seed.json")

async function readStore() {
  for (const file of [dataFile, seedFile]) {
    try {
      const raw = await fs.readFile(file, "utf8")
      return {
        file,
        store: JSON.parse(raw),
      }
    } catch {
      // tenta o próximo
    }
  }

  throw new Error(
    `Não foi possível ler ${dataFile} nem ${seedFile}.`,
  )
}

function phone(value) {
  return String(value || "").replace(/\D/g, "")
}

function email(value) {
  return String(value || "").trim().toLowerCase()
}

function date(value) {
  const parsed = new Date(value || "")
  return Number.isNaN(parsed.getTime())
    ? new Date()
    : parsed
}

function validateAccounts(accounts) {
  const errors = []
  const ids = new Set()
  const cpfHashes = new Set()

  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index]
    const label =
      `conta[${index}] id=${account?.id ?? "?"}`

    const id = Number(account?.id)

    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`${label}: id inválido`)
      continue
    }

    if (ids.has(id)) {
      errors.push(`${label}: id duplicado`)
    }
    ids.add(id)

    const hash = String(account?.cpfHash || "")
    if (!hash) {
      errors.push(`${label}: cpfHash ausente`)
    } else if (cpfHashes.has(hash)) {
      errors.push(`${label}: CPF duplicado`)
    }
    cpfHashes.add(hash)

    if (!String(account?.pinHash || "")) {
      errors.push(`${label}: pinHash ausente`)
    }

    if (!String(account?.name || "").trim()) {
      errors.push(`${label}: nome ausente`)
    }

    if (!String(account?.phone || "").trim()) {
      errors.push(`${label}: telefone ausente`)
    }
  }

  return errors
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10_000,
})

async function main() {
  const { file, store } = await readStore()

  const accounts = Array.isArray(store.customerAccounts)
    ? store.customerAccounts
    : []

  const validationErrors = validateAccounts(accounts)

  if (validationErrors.length) {
    console.error("")
    console.error(
      `Importação cancelada: ${validationErrors.length} inconsistência(s) encontrada(s).`,
    )

    for (const issue of validationErrors.slice(0, 20)) {
      console.error(`- ${issue}`)
    }

    process.exit(1)
  }

  const client = await pool.connect()

  try {
    const orgResult = await client.query(
      `
        SELECT o.id, o.trade_name, o.slug
        FROM sf_users u
        INNER JOIN sf_memberships m
          ON m.user_id = u.id
         AND m.status = 'active'
        INNER JOIN sf_organizations o
          ON o.id = m.organization_id
         AND o.status IN ('active', 'trial')
        WHERE lower(u.email) = lower($1)
        ORDER BY
          CASE m.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
          END,
          m.created_at ASC
        LIMIT 1
      `,
      [adminEmail],
    )

    const organization = orgResult.rows[0]

    if (!organization) {
      throw new Error(
        "Nenhuma organização ativa foi encontrada para ADMIN_EMAIL.",
      )
    }

    const schemaResult = await client.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sf_customers_state'
      `,
    )

    if (!schemaResult.rowCount) {
      throw new Error(
        "Migration 005 ainda não foi aplicada. Rode node scripts/migrate-multiempresa.mjs primeiro.",
      )
    }

    const state = await client.query(
      `
        SELECT ready, accounts_count, imported_at
        FROM sf_customers_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organization.id],
    )

    if (state.rows[0]?.ready && !force) {
      console.log("")
      console.log(
        "Contas de clientes já foram importadas para esta organização.",
      )
      console.log(`Empresa: ${organization.trade_name}`)
      console.log(`Contas: ${state.rows[0].accounts_count}`)
      console.log("")
      console.log(
        "Nada foi alterado. Não use --force sem necessidade.",
      )
      return
    }

    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-customers:${organization.id}`],
    )

    await client.query(
      `
        DELETE FROM sf_customer_accounts
        WHERE organization_id = $1
      `,
      [organization.id],
    )

    for (const account of accounts) {
      await client.query(
        `
          INSERT INTO sf_customer_accounts (
            organization_id,
            id,
            cpf_hash,
            cpf_last4,
            pin_hash,
            google_subject,
            name,
            phone,
            phone_normalized,
            email,
            email_normalized,
            default_address,
            default_number,
            default_district,
            default_city,
            default_state,
            default_zip_code,
            default_complement,
            default_latitude,
            default_longitude,
            loyalty_points,
            active,
            auth_provider,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, NULL,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, 'cpf_pin', $22, $23
          )
        `,
        [
          organization.id,
          Number(account.id),
          String(account.cpfHash),
          String(account.cpfLast4 || "").slice(-4),
          String(account.pinHash),
          String(account.name || "").trim(),
          String(account.phone || "").trim(),
          phone(account.phone),
          String(account.email || "").trim(),
          email(account.email),
          String(account.defaultAddress || ""),
          String(account.defaultNumber || ""),
          String(account.defaultDistrict || ""),
          String(account.defaultCity || ""),
          String(account.defaultState || ""),
          String(account.defaultZipCode || ""),
          String(account.defaultComplement || ""),
          account.defaultLatitude ?? null,
          account.defaultLongitude ?? null,
          Math.max(
            0,
            Math.floor(Number(account.loyaltyPoints || 0)),
          ),
          account.active !== false,
          date(account.createdAt),
          date(account.updatedAt),
        ],
      )
    }

    await client.query(
      `
        INSERT INTO sf_customers_state (
          organization_id,
          ready,
          source,
          accounts_count,
          imported_at,
          updated_at
        )
        VALUES ($1, true, $2, $3, now(), now())
        ON CONFLICT (organization_id)
        DO UPDATE SET
          ready = true,
          source = EXCLUDED.source,
          accounts_count = EXCLUDED.accounts_count,
          imported_at = now(),
          updated_at = now()
      `,
      [
        organization.id,
        file,
        accounts.length,
      ],
    )

    await client.query(
      `
        INSERT INTO sf_audit_log (
          id,
          organization_id,
          user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        SELECT
          $1,
          $2,
          u.id,
          'customers.import',
          'organization',
          $3,
          $4::jsonb
        FROM sf_users u
        WHERE lower(u.email) = lower($5)
        LIMIT 1
      `,
      [
        randomUUID(),
        organization.id,
        String(organization.id),
        JSON.stringify({
          source: file,
          accounts: accounts.length,
          forced: force,
        }),
        adminEmail,
      ],
    )

    await client.query("COMMIT")

    console.log("")
    console.log(
      "SaborFlow - clientes/contas multiempresa importados com sucesso.",
    )
    console.log(`Empresa: ${organization.trade_name}`)
    console.log(`Slug: ${organization.slug}`)
    console.log(`Organization ID: ${organization.id}`)
    console.log(`Contas com CPF/PIN: ${accounts.length}`)
    console.log(`Origem: ${file}`)
    console.log("")
    console.log(
      "CPF puro não foi copiado. O PostgreSQL recebeu somente o hash já existente e os últimos 4 dígitos.",
    )
    console.log(
      "store.json não foi apagado nem alterado.",
    )

    if (file.endsWith("store.seed.json")) {
      console.log("")
      console.log(
        "ATENÇÃO: a origem usada foi store.seed.json. Se você esperava contas reais já cadastradas, confira DATA_FILE/Volume antes de avançar.",
      )
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK")
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
    "Falha na importação de clientes/contas:",
  )
  console.error(error)
  process.exit(1)
})
