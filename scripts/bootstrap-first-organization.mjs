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

const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
if (!adminEmail) {
  console.error("ERRO: ADMIN_EMAIL não está configurado.")
  process.exit(1)
}

const dataFile =
  process.env.DATA_FILE ||
  path.join(process.cwd(), "data", "store.json")

const seedFile =
  path.join(process.cwd(), "data", "store.seed.json")

function slugify(value) {
  return String(value || "empresa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "empresa"
}

async function readCurrentStore() {
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

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10000,
})

async function main() {
  const { file, store } = await readCurrentStore()
  const settings = store?.settings || {}

  const storeName =
    String(settings.storeName || "").trim() || "Minha empresa"

  const slug = slugify(storeName)
  const adminName =
    String(process.env.ADMIN_NAME || "").trim() || "Administrador"

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const schemaCheck = await client.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_organizations'
          AND column_name = 'onboarding_status'
      `,
    )

    if (!schemaCheck.rowCount) {
      throw new Error(
        "Migration 002 ainda não foi aplicada. Rode node scripts/migrate-multiempresa.mjs primeiro.",
      )
    }

    let userId

    const existingUser = await client.query(
      `
        SELECT id
        FROM sf_users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [adminEmail],
    )

    if (existingUser.rowCount) {
      userId = existingUser.rows[0].id

      await client.query(
        `
          UPDATE sf_users
          SET name = $2,
              status = 'active',
              updated_at = now()
          WHERE id = $1
        `,
        [userId, adminName],
      )
    } else {
      userId = randomUUID()

      await client.query(
        `
          INSERT INTO sf_users (
            id, name, email, status
          )
          VALUES ($1, $2, $3, 'active')
        `,
        [userId, adminName, adminEmail],
      )
    }

    let organizationId

    const existingOrg = await client.query(
      `
        SELECT id
        FROM sf_organizations
        WHERE lower(slug) = lower($1)
        LIMIT 1
      `,
      [slug],
    )

    if (existingOrg.rowCount) {
      organizationId = existingOrg.rows[0].id

      await client.query(
        `
          UPDATE sf_organizations
          SET trade_name = $2,
              phone = $3,
              email = $4,
              status = 'active',
              updated_at = now()
          WHERE id = $1
        `,
        [
          organizationId,
          storeName,
          settings.phone || settings.whatsapp || null,
          adminEmail,
        ],
      )
    } else {
      organizationId = randomUUID()

      await client.query(
        `
          INSERT INTO sf_organizations (
            id,
            person_type,
            document,
            trade_name,
            legal_name,
            slug,
            industry,
            phone,
            email,
            status,
            onboarding_status
          )
          VALUES (
            $1,
            NULL,
            NULL,
            $2,
            NULL,
            $3,
            NULL,
            $4,
            $5,
            'active',
            'pending'
          )
        `,
        [
          organizationId,
          storeName,
          slug,
          settings.phone || settings.whatsapp || null,
          adminEmail,
        ],
      )
    }

    const membership = await client.query(
      `
        SELECT id
        FROM sf_memberships
        WHERE user_id = $1
          AND organization_id = $2
        LIMIT 1
      `,
      [userId, organizationId],
    )

    if (membership.rowCount) {
      await client.query(
        `
          UPDATE sf_memberships
          SET role = 'owner',
              status = 'active',
              updated_at = now()
          WHERE id = $1
        `,
        [membership.rows[0].id],
      )
    } else {
      await client.query(
        `
          INSERT INTO sf_memberships (
            id,
            organization_id,
            user_id,
            role,
            status
          )
          VALUES ($1, $2, $3, 'owner', 'active')
        `,
        [randomUUID(), organizationId, userId],
      )
    }

    await client.query(
      `
        INSERT INTO sf_organization_settings (
          organization_id,
          timezone,
          locale,
          currency,
          settings
        )
        VALUES (
          $1,
          'America/Sao_Paulo',
          'pt-BR',
          'BRL',
          $2::jsonb
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
          settings = EXCLUDED.settings,
          updated_at = now()
      `,
      [organizationId, JSON.stringify(settings)],
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
        VALUES (
          $1,
          $2,
          $3,
          'organization.bootstrap',
          'organization',
          $2::text,
          $4::jsonb
        )
      `,
      [
        randomUUID(),
        organizationId,
        userId,
        JSON.stringify({
          source: file,
          storeName,
          migration: "legacy-single-company-to-multi-tenant",
        }),
      ],
    )

    await client.query("COMMIT")

    console.log("")
    console.log("SaborFlow - primeira organização inicializada com sucesso.")
    console.log(`Empresa: ${storeName}`)
    console.log(`Slug: ${slug}`)
    console.log(`Organization ID: ${organizationId}`)
    console.log(`Owner: ${adminEmail}`)
    console.log(`User ID: ${userId}`)
    console.log("")
    console.log("Documento CPF/CNPJ ficou pendente para o onboarding.")
    console.log("Agora saia do Admin e faça login novamente para gerar a sessão multiempresa.")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("Falha no bootstrap da primeira organização:")
  console.error(error)
  process.exit(1)
})
