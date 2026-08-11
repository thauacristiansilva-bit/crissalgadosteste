import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import pg from "pg"

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error(
    "ERRO: DATABASE_URL não está configurada.",
  )
  process.exit(1)
}

const adminEmail = (
  process.env.ADMIN_EMAIL || ""
)
  .trim()
  .toLowerCase()

if (!adminEmail) {
  console.error(
    "ERRO: ADMIN_EMAIL não está configurado.",
  )
  process.exit(1)
}

const force = process.argv.includes("--force")

const volumeMount = (
  process.env.RAILWAY_VOLUME_MOUNT_PATH || ""
).trim()

const dataFile =
  process.env.DATA_FILE ||
  (volumeMount
    ? path.join(volumeMount, "store.json")
    : path.join(
        process.cwd(),
        "data",
        "store.json",
      ))

const seedFile = path.join(
  process.cwd(),
  "data",
  "store.seed.json",
)

async function readStore() {
  for (const file of [dataFile, seedFile]) {
    try {
      const raw = await fs.readFile(
        file,
        "utf8",
      )

      return {
        file,
        store: JSON.parse(raw),
      }
    } catch {
      // tenta próximo
    }
  }

  throw new Error(
    `Não foi possível ler ${dataFile} nem ${seedFile}.`,
  )
}

function validDate(value) {
  const date = new Date(value || "")
  return Number.isNaN(date.getTime())
    ? new Date()
    : date
}

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

function validateStaff(staffMembers) {
  const errors = []
  const ids = new Set()
  const emails = new Set()

  for (
    let index = 0;
    index < staffMembers.length;
    index += 1
  ) {
    const member = staffMembers[index]
    const id = Number(member?.id)

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      errors.push(
        `colaborador[${index}]: id inválido`,
      )
      continue
    }

    if (ids.has(id)) {
      errors.push(
        `colaborador id ${id} duplicado`,
      )
    }

    ids.add(id)

    if (!String(member?.name || "").trim()) {
      errors.push(
        `colaborador ${id}: nome vazio`,
      )
    }

    const role = String(
      member?.role || "",
    )

    if (
      ![
        "admin",
        "manager",
        "cashier",
        "kitchen",
        "courier",
      ].includes(role)
    ) {
      errors.push(
        `colaborador ${id}: papel inválido`,
      )
    }

    const email = String(
      member?.email || "",
    )
      .trim()
      .toLowerCase()

    if (email) {
      if (emails.has(email)) {
        errors.push(
          `colaborador ${id}: e-mail duplicado`,
        )
      }

      emails.add(email)
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

  if (file.endsWith("store.seed.json")) {
    throw new Error(
      "Origem incorreta: store.seed.json. A Fase 6.1 deveria estar usando /data/store.json.",
    )
  }

  const settings = store?.settings

  if (
    !settings ||
    typeof settings !== "object" ||
    !String(settings.storeName || "").trim()
  ) {
    throw new Error(
      "Configurações da empresa estão ausentes ou inválidas.",
    )
  }

  const staffMembers = Array.isArray(
    store.staffMembers,
  )
    ? store.staffMembers
    : []

  const staffErrors =
    validateStaff(staffMembers)

  if (staffErrors.length) {
    console.error("")
    console.error(
      `Importação cancelada: ${staffErrors.length} inconsistência(s) na equipe.`,
    )

    for (const issue of staffErrors.slice(0, 30)) {
      console.error(`- ${issue}`)
    }

    process.exit(1)
  }

  const client = await pool.connect()

  try {
    const orgResult = await client.query(
      `
        SELECT
          o.id,
          o.trade_name,
          o.slug
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

    const schema = await client.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sf_tenant_runtime_state'
        LIMIT 1
      `,
    )

    if (!schema.rowCount) {
      throw new Error(
        "Migration 007 ainda não foi aplicada. Rode node scripts/migrate-multiempresa.mjs primeiro.",
      )
    }

    const current = await client.query(
      `
        SELECT ready
        FROM sf_tenant_runtime_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organization.id],
    )

    if (current.rows[0]?.ready && !force) {
      console.log("")
      console.log(
        "Runtime da empresa já foi importado.",
      )
      console.log(
        `Empresa: ${organization.trade_name}`,
      )
      console.log("")
      console.log(
        "Nada foi alterado. Não use --force sem necessidade.",
      )
      return
    }

    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-runtime:${organization.id}`],
    )

    await client.query(
      `
        INSERT INTO sf_organization_settings (
          organization_id,
          timezone,
          locale,
          currency,
          settings,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'America/Sao_Paulo',
          'pt-BR',
          'BRL',
          $2::jsonb,
          now(),
          now()
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
          settings = EXCLUDED.settings,
          updated_at = now()
      `,
      [
        organization.id,
        JSON.stringify({
          ...settings,
          systemName: "SaborFlow",
        }),
      ],
    )

    await client.query(
      `
        UPDATE sf_organizations
        SET
          trade_name = $2,
          phone = $3,
          public_store_enabled = true,
          public_ordering_enabled = true,
          updated_at = now()
        WHERE id = $1
      `,
      [
        organization.id,
        String(settings.storeName || "")
          .trim(),
        String(settings.phone || "")
          .trim() || null,
      ],
    )

    await client.query(
      `
        DELETE FROM sf_staff_members
        WHERE organization_id = $1
      `,
      [organization.id],
    )

    for (const member of staffMembers) {
      await client.query(
        `
          INSERT INTO sf_staff_members (
            organization_id,
            id,
            name,
            email,
            phone,
            role,
            active,
            permissions,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8::jsonb, $9, $10
          )
        `,
        [
          organization.id,
          Number(member.id),
          String(member.name || "").trim(),
          String(member.email || "")
            .trim()
            .toLowerCase(),
          String(member.phone || "").trim(),
          String(member.role || "cashier"),
          member.active !== false,
          JSON.stringify(
            Array.isArray(member.permissions)
              ? member.permissions.map(String)
              : [],
          ),
          validDate(member.createdAt),
          validDate(member.updatedAt),
        ],
      )
    }

    const railwayDomain =
      normalizeDomain(
        process.env.RAILWAY_PUBLIC_DOMAIN,
      )

    if (railwayDomain) {
      await client.query(
        `
          INSERT INTO sf_organization_domains (
            domain,
            organization_id,
            verified,
            primary_domain,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, true, true, now(), now()
          )
          ON CONFLICT (domain)
          DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            verified = true,
            primary_domain = true,
            updated_at = now()
        `,
        [
          railwayDomain,
          organization.id,
        ],
      )
    }

    const domainCountResult =
      await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM sf_organization_domains
          WHERE organization_id = $1
        `,
        [organization.id],
      )

    const domainCount = Number(
      domainCountResult.rows[0]?.count || 0,
    )

    await client.query(
      `
        INSERT INTO sf_tenant_runtime_state (
          organization_id,
          ready,
          source,
          settings_ready,
          staff_ready,
          public_ready,
          staff_count,
          domains_count,
          imported_at,
          updated_at
        )
        VALUES (
          $1,
          true,
          $2,
          true,
          true,
          true,
          $3,
          $4,
          now(),
          now()
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
          ready = true,
          source = EXCLUDED.source,
          settings_ready = true,
          staff_ready = true,
          public_ready = true,
          staff_count = EXCLUDED.staff_count,
          domains_count = EXCLUDED.domains_count,
          imported_at = now(),
          updated_at = now()
      `,
      [
        organization.id,
        file,
        staffMembers.length,
        domainCount,
      ],
    )

    await client.query("COMMIT")

    console.log("")
    console.log(
      "SaborFlow - runtime da empresa importado com sucesso.",
    )
    console.log(
      `Empresa: ${String(settings.storeName).trim()}`,
    )
    console.log(
      `Slug: ${organization.slug}`,
    )
    console.log(
      `Organization ID: ${organization.id}`,
    )
    console.log(
      `Colaboradores: ${staffMembers.length}`,
    )
    console.log(
      `Domínios registrados: ${domainCount}`,
    )
    console.log(`Origem: ${file}`)
    console.log("")
    console.log(
      `Loja por slug: /loja/${organization.slug}`,
    )

    if (railwayDomain) {
      console.log(
        `Domínio Railway: https://${railwayDomain}`,
      )
    }

    console.log("")
    console.log(
      "A empresa atual permanece com pedidos online habilitados.",
    )
    console.log(
      "Novas empresas futuras nascerão com pedidos online desabilitados até o onboarding operacional.",
    )
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
    "Falha na importação do runtime da empresa:",
  )
  console.error(error)
  process.exit(1)
})
