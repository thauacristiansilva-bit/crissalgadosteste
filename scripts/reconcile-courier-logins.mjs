import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import pg from "pg"

const { Pool } = pg

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const filepath = path.join(process.cwd(), filename)
    if (!fs.existsSync(filepath)) continue
    const text = fs.readFileSync(filepath, "utf8")
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith("#")) continue
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match || process.env[match[1]]) continue
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[match[1]] = value
    }
  }
}

loadLocalEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não está configurada no terminal nem em .env.local/.env.")
  console.error("Configure a conexão PostgreSQL do SaborFlow antes de executar esta reconciliação.")
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10000,
})

function digits(value) {
  return String(value || "").replace(/\D/g, "")
}

async function reconcileOne(client, row) {
  const linked = await client.query(
    `
      SELECT id, active
      FROM sf_couriers
      WHERE organization_id = $1
        AND staff_member_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [row.organization_id, row.staff_member_id],
  )

  if (linked.rows[0]) {
    if (!linked.rows[0].active) {
      await client.query(
        `UPDATE sf_couriers SET active = true, updated_at = now() WHERE organization_id = $1 AND id = $2`,
        [row.organization_id, linked.rows[0].id],
      )
      return "activated"
    }
    return "ok"
  }

  const phoneDigits = digits(row.phone)
  const candidates = await client.query(
    `
      SELECT id
      FROM sf_couriers
      WHERE organization_id = $1
        AND staff_member_id IS NULL
        AND (
          ($2 <> '' AND regexp_replace(phone, '[^0-9]', '', 'g') = $2)
          OR lower(trim(name)) = lower(trim($3))
        )
      ORDER BY id ASC
      FOR UPDATE
    `,
    [row.organization_id, phoneDigits, row.name],
  )

  if (candidates.rows.length === 1) {
    await client.query(
      `
        UPDATE sf_couriers
        SET staff_member_id = $3, active = true, updated_at = now()
        WHERE organization_id = $1
          AND id = $2
          AND staff_member_id IS NULL
      `,
      [row.organization_id, candidates.rows[0].id, row.staff_member_id],
    )
    return "linked"
  }

  if (candidates.rows.length > 1) return "ambiguous"
  if (!String(row.phone || "").trim()) return "missing-phone"

  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`saborflow-courier-id:${row.organization_id}`],
  )
  const next = await client.query(
    `SELECT COALESCE(MAX(id), 0)::int + 1 AS next_id FROM sf_couriers WHERE organization_id = $1`,
    [row.organization_id],
  )
  await client.query(
    `
      INSERT INTO sf_couriers (
        organization_id, id, name, phone, vehicle, active,
        staff_member_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, '', true, $5, now(), now())
    `,
    [row.organization_id, Number(next.rows[0]?.next_id || 1), row.name, row.phone, row.staff_member_id],
  )
  return "created"
}


async function repairConsumedInvites(client) {
  const candidates = await client.query(`
    SELECT DISTINCT
      m.organization_id,
      m.user_id,
      m.role,
      u.email
    FROM sf_memberships m
    INNER JOIN sf_users u
      ON u.id = m.user_id
    WHERE m.status = 'invited'
      AND u.status <> 'blocked'
      AND u.password_hash IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM sf_auth_tokens t
        WHERE t.organization_id = m.organization_id
          AND t.user_id = m.user_id
          AND t.purpose = 'invite'
          AND t.used_at IS NOT NULL
      )
    ORDER BY m.organization_id, m.user_id
  `)

  let repaired = 0
  for (const row of candidates.rows) {
    await client.query("BEGIN")
    try {
      const staff = await client.query(
        `
          SELECT id, name, phone, role
          FROM sf_staff_members
          WHERE organization_id = $1
            AND lower(email) = lower($2)
            AND role = $3
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE
        `,
        [row.organization_id, row.email, row.role],
      )

      if (!staff.rows[0]) {
        await client.query("ROLLBACK")
        console.log(`${row.email}: convite consumido, mas colaborador correspondente não foi encontrado; revisão manual necessária.`)
        continue
      }

      await client.query(
        `UPDATE sf_users SET status = 'active', updated_at = now() WHERE id = $1 AND status <> 'blocked'`,
        [row.user_id],
      )
      await client.query(
        `
          UPDATE sf_memberships
          SET status = 'active', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
          WHERE organization_id = $1
            AND user_id = $2
            AND status = 'invited'
        `,
        [row.organization_id, row.user_id],
      )
      await client.query(
        `
          UPDATE sf_staff_members
          SET user_id = $3, active = true, updated_at = now()
          WHERE organization_id = $1
            AND id = $2
        `,
        [row.organization_id, staff.rows[0].id, row.user_id],
      )

      await client.query("COMMIT")
      repaired += 1
      console.log(`${row.email}: membership do convite consumido reconciliada para active.`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  }
  return repaired
}

async function main() {
  const client = await pool.connect()
  const totals = { ok: 0, activated: 0, linked: 0, created: 0, ambiguous: 0, "missing-phone": 0 }

  try {
    const schema = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_couriers'
          AND column_name = 'staff_member_id'
      ) AS ready
    `)
    if (!schema.rows[0]?.ready) {
      throw new Error("A migration 025_delivery_dispatch_identity ainda não está aplicada.")
    }

    const repairedInvites = await repairConsumedInvites(client)
    if (repairedInvites) {
      console.log(`\nConvites antigos reconciliados: ${repairedInvites}\n`)
    }

    const rows = await client.query(`
      SELECT
        m.organization_id,
        s.id AS staff_member_id,
        s.name,
        s.phone,
        s.email,
        u.id AS user_id
      FROM sf_memberships m
      INNER JOIN sf_users u
        ON u.id = m.user_id
       AND u.status = 'active'
      INNER JOIN sf_staff_members s
        ON s.organization_id = m.organization_id
       AND s.user_id = u.id
       AND s.role = 'courier'
       AND s.active = true
      WHERE m.role = 'courier'
        AND m.status = 'active'
      ORDER BY m.organization_id, s.id
    `)

    if (!rows.rows.length) {
      console.log("Nenhum login ativo de entregador encontrado para reconciliar.")
      return
    }

    for (const row of rows.rows) {
      await client.query("BEGIN")
      try {
        const result = await reconcileOne(client, row)
        totals[result] += 1
        await client.query("COMMIT")
        console.log(`${row.email}: ${result}`)
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }

    console.log("\nResumo:")
    console.log(JSON.stringify(totals, null, 2))
    if (totals.ambiguous || totals["missing-phone"]) {
      console.log("\nHá perfis que exigem revisão manual em Configurações → Entregadores.")
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("ERRO:", error instanceof Error ? error.message : error)
  process.exit(1)
})
