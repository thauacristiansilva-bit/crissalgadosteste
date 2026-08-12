import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto"
import { resolveTxt } from "node:dns/promises"
import { getPostgresPool } from "@/lib/postgres"
import {
  normalizePublicDomain,
} from "@/lib/organization-db"

const DOMAIN_TXT_PREFIX =
  "saborflow-verification="

function hashToken(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex")
}

export function isValidTimeZone(
  value: string,
) {
  try {
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone: value,
      },
    ).format(new Date())

    return true
  } catch {
    return false
  }
}

export async function getOrganizationTimeZone(
  organizationId: string,
) {
  const result =
    await getPostgresPool().query<{
      timezone: string
    }>(
      `
        SELECT timezone
        FROM sf_organization_settings
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    )

  return (
    result.rows[0]?.timezone ||
    "America/Sao_Paulo"
  )
}

export async function updateOrganizationTimeZone(
  organizationId: string,
  timeZone: string,
) {
  const clean = timeZone.trim()

  if (!isValidTimeZone(clean)) {
    throw new Error(
      "Timezone inválido.",
    )
  }

  const result =
    await getPostgresPool().query<{
      timezone: string
    }>(
      `
        UPDATE sf_organization_settings
        SET
          timezone = $2,
          updated_at = now()
        WHERE organization_id = $1
        RETURNING timezone
      `,
      [organizationId, clean],
    )

  if (!result.rows[0]) {
    throw new Error(
      "Configurações da organização não encontradas.",
    )
  }

  return result.rows[0].timezone
}

export type OrganizationDomainStatus = {
  domain: string
  verified: boolean
  primary: boolean
  verificationMethod: "dns_txt"
  verificationRecordName: string
  verifiedAt: string | null
  lastCheckedAt: string | null
}

function mapDomainRow(
  row: {
    domain: string
    verified: boolean
    primary_domain: boolean
    verification_method: "dns_txt"
    verified_at: Date | string | null
    last_checked_at: Date | string | null
  },
): OrganizationDomainStatus {
  return {
    domain: row.domain,
    verified:
      Boolean(row.verified),
    primary:
      Boolean(
        row.primary_domain,
      ),
    verificationMethod:
      row.verification_method,
    verificationRecordName:
      `_saborflow.${row.domain}`,
    verifiedAt: row.verified_at
      ? new Date(
          row.verified_at,
        ).toISOString()
      : null,
    lastCheckedAt:
      row.last_checked_at
        ? new Date(
            row.last_checked_at,
          ).toISOString()
        : null,
  }
}

export async function listOrganizationDomains(
  organizationId: string,
) {
  const result =
    await getPostgresPool().query<{
      domain: string
      verified: boolean
      primary_domain: boolean
      verification_method: "dns_txt"
      verified_at: Date | string | null
      last_checked_at: Date | string | null
    }>(
      `
        SELECT
          domain,
          verified,
          primary_domain,
          verification_method,
          verified_at,
          last_checked_at
        FROM sf_organization_domains
        WHERE organization_id = $1
        ORDER BY
          primary_domain DESC,
          verified DESC,
          domain ASC
      `,
      [organizationId],
    )

  return result.rows.map(
    mapDomainRow,
  )
}

function isReservedHost(
  domain: string,
) {
  const railway =
    normalizePublicDomain(
      process.env
        .RAILWAY_PUBLIC_DOMAIN ||
        "",
    )

  return Boolean(
    railway &&
      domain === railway,
  )
}

export async function createDomainVerification(
  input: {
    organizationId: string
    domain: string
  },
) {
  const domain =
    normalizePublicDomain(
      input.domain,
    )

  if (
    !domain ||
    !domain.includes(".") ||
    domain.includes(" ") ||
    domain.includes("/")
  ) {
    throw new Error(
      "Informe um domínio válido, sem http:// ou caminhos.",
    )
  }

  if (isReservedHost(domain)) {
    throw new Error(
      "O domínio público padrão do Railway já é gerenciado pelo SaborFlow e não precisa de verificação.",
    )
  }

  const challenge =
    `${DOMAIN_TXT_PREFIX}${randomBytes(
      24,
    ).toString("base64url")}`

  const challengeHash =
    hashToken(challenge)

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const existing =
      await client.query<{
        organization_id: string
        verified: boolean
      }>(
        `
          SELECT
            organization_id,
            verified
          FROM sf_organization_domains
          WHERE domain = $1
          LIMIT 1
          FOR UPDATE
        `,
        [domain],
      )

    const current =
      existing.rows[0]

    if (
      current &&
      current.organization_id !==
        input.organizationId
    ) {
      throw new Error(
        "Este domínio já está vinculado a outra empresa.",
      )
    }

    if (
      current?.verified
    ) {
      throw new Error(
        "Este domínio já está verificado.",
      )
    }

    await client.query(
      `
        INSERT INTO sf_organization_domains (
          domain,
          organization_id,
          verified,
          primary_domain,
          verification_method,
          verification_token_hash,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          false,
          false,
          'dns_txt',
          $3,
          now(),
          now()
        )
        ON CONFLICT (domain)
        DO UPDATE SET
          organization_id =
            EXCLUDED.organization_id,
          verified = false,
          primary_domain = false,
          verification_method =
            'dns_txt',
          verification_token_hash =
            EXCLUDED.verification_token_hash,
          verified_at = NULL,
          last_checked_at = NULL,
          updated_at = now()
      `,
      [
        domain,
        input.organizationId,
        challengeHash,
      ],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return {
    domain,
    recordName:
      `_saborflow.${domain}`,
    recordValue:
      challenge,
    method:
      "dns_txt" as const,
  }
}

export async function verifyOrganizationDomain(
  input: {
    organizationId: string
    domain: string
  },
) {
  const domain =
    normalizePublicDomain(
      input.domain,
    )

  const result =
    await getPostgresPool().query<{
      verification_token_hash:
        | string
        | null
      verified: boolean
    }>(
      `
        SELECT
          verification_token_hash,
          verified
        FROM sf_organization_domains
        WHERE organization_id = $1
          AND domain = $2
        LIMIT 1
      `,
      [
        input.organizationId,
        domain,
      ],
    )

  const row = result.rows[0]

  if (!row) {
    throw new Error(
      "Domínio não encontrado nesta empresa.",
    )
  }

  if (row.verified) {
    return {
      verified: true,
      domain,
    }
  }

  if (
    !row.verification_token_hash
  ) {
    throw new Error(
      "Gere novamente o registro de verificação deste domínio.",
    )
  }

  const recordName =
    `_saborflow.${domain}`

  let records: string[][] = []

  try {
    records =
      await resolveTxt(
        recordName,
      )
  } catch {
    records = []
  }

  const values = records.map(
    (parts) => parts.join(""),
  )

  const matched =
    values.some(
      (value) =>
        hashToken(value) ===
        row.verification_token_hash,
    )

  await getPostgresPool().query(
    `
      UPDATE sf_organization_domains
      SET
        last_checked_at = now(),
        updated_at = now()
      WHERE organization_id = $1
        AND domain = $2
    `,
    [
      input.organizationId,
      domain,
    ],
  )

  if (!matched) {
    throw new Error(
      `Registro TXT ainda não encontrado em ${recordName}.`,
    )
  }

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const hasPrimary =
      await client.query(
        `
          SELECT 1
          FROM sf_organization_domains
          WHERE organization_id = $1
            AND verified = true
            AND primary_domain = true
            AND domain <> $2
          LIMIT 1
        `,
        [
          input.organizationId,
          domain,
        ],
      )

    await client.query(
      `
        UPDATE sf_organization_domains
        SET
          verified = true,
          verified_at = now(),
          last_checked_at = now(),
          primary_domain = $3,
          updated_at = now()
        WHERE organization_id = $1
          AND domain = $2
      `,
      [
        input.organizationId,
        domain,
        !hasPrimary.rowCount,
      ],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return {
    verified: true,
    domain,
  }
}

export async function removeOrganizationDomain(
  input: {
    organizationId: string
    domain: string
  },
) {
  const domain =
    normalizePublicDomain(
      input.domain,
    )

  if (isReservedHost(domain)) {
    throw new Error(
      "O domínio padrão do Railway não pode ser removido por esta tela.",
    )
  }

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const deleted =
      await client.query<{
        primary_domain: boolean
      }>(
        `
          DELETE FROM sf_organization_domains
          WHERE organization_id = $1
            AND domain = $2
          RETURNING primary_domain
        `,
        [
          input.organizationId,
          domain,
        ],
      )

    if (!deleted.rows[0]) {
      throw new Error(
        "Domínio não encontrado.",
      )
    }

    if (
      deleted.rows[0]
        .primary_domain
    ) {
      await client.query(
        `
          UPDATE sf_organization_domains
          SET
            primary_domain = true,
            updated_at = now()
          WHERE domain = (
            SELECT domain
            FROM sf_organization_domains
            WHERE organization_id = $1
              AND verified = true
            ORDER BY verified_at ASC, domain ASC
            LIMIT 1
          )
        `,
        [input.organizationId],
      )
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return true
}


export type PrintAgentSummary = {
  id: string
  name: string
  active: boolean
  lastSeenAt: string | null
  createdAt: string
}

function printTokenHash(
  token: string,
) {
  return hashToken(token)
}

export async function listPrintAgents(
  organizationId: string,
) {
  const result =
    await getPostgresPool().query<{
      id: string
      name: string
      active: boolean
      last_seen_at: Date | string | null
      created_at: Date | string
    }>(
      `
        SELECT
          id,
          name,
          active,
          last_seen_at,
          created_at
        FROM sf_print_agents
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `,
      [organizationId],
    )

  return result.rows.map(
    (row): PrintAgentSummary => ({
      id: row.id,
      name: row.name,
      active:
        Boolean(row.active),
      lastSeenAt:
        row.last_seen_at
          ? new Date(
              row.last_seen_at,
            ).toISOString()
          : null,
      createdAt:
        new Date(
          row.created_at,
        ).toISOString(),
    }),
  )
}

export async function createPrintAgent(
  input: {
    organizationId: string
    name: string
    createdByUserId: string
  },
) {
  const name =
    input.name.trim()

  if (!name) {
    throw new Error(
      "Informe um nome para o agente de impressão.",
    )
  }

  const token =
    `sfpa_${randomBytes(
      32,
    ).toString("base64url")}`

  const id = randomUUID()

  await getPostgresPool().query(
    `
      INSERT INTO sf_print_agents (
        id,
        organization_id,
        name,
        token_hash,
        active,
        created_by_user_id,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        true,
        $5,
        now()
      )
    `,
    [
      id,
      input.organizationId,
      name,
      printTokenHash(token),
      input.createdByUserId,
    ],
  )

  return {
    id,
    name,
    token,
  }
}

export async function revokePrintAgent(
  organizationId: string,
  id: string,
) {
  const result =
    await getPostgresPool().query(
      `
        UPDATE sf_print_agents
        SET
          active = false,
          revoked_at = now()
        WHERE organization_id = $1
          AND id = $2
          AND active = true
        RETURNING id
      `,
      [organizationId, id],
    )

  return Boolean(result.rowCount)
}

export async function authenticatePrintAgent(
  token: string,
) {
  if (!token) return null

  const result =
    await getPostgresPool().query<{
      id: string
      organization_id: string
      name: string
      organization_name: string
      organization_slug: string
    }>(
      `
        SELECT
          a.id,
          a.organization_id,
          a.name,
          o.trade_name AS organization_name,
          o.slug AS organization_slug
        FROM sf_print_agents a
        INNER JOIN sf_organizations o
          ON o.id = a.organization_id
         AND o.status IN ('active', 'trial')
        WHERE a.token_hash = $1
          AND a.active = true
        LIMIT 1
      `,
      [printTokenHash(token)],
    )

  const row = result.rows[0]
  if (!row) return null

  await getPostgresPool().query(
    `
      UPDATE sf_print_agents
      SET last_seen_at = now()
      WHERE id = $1
    `,
    [row.id],
  )

  return {
    agentId: row.id,
    agentName: row.name,
    organizationId:
      row.organization_id,
    organizationName:
      row.organization_name,
    organizationSlug:
      row.organization_slug,
  }
}


export async function getRlsRolloutStats() {
  const result =
    await getPostgresPool().query<{
      table_name: string
      prepared: boolean
      enforcement:
        | "prepared"
        | "enabled"
      row_security_enabled: boolean
    }>(
      `
        SELECT
          r.table_name,
          r.prepared,
          r.enforcement,
          COALESCE(c.relrowsecurity, false) AS row_security_enabled
        FROM sf_rls_rollout r
        LEFT JOIN pg_class c
          ON c.oid = to_regclass(
            'public.' || r.table_name
          )
        ORDER BY r.table_name ASC
      `,
    )

  const tables = result.rows.map(
    (row) => ({
      table: row.table_name,
      prepared:
        Boolean(row.prepared),
      enforcement:
        row.enforcement,
      rowSecurityEnabled:
        Boolean(
          row.row_security_enabled,
        ),
    }),
  )

  return {
    prepared:
      tables.length > 0 &&
      tables.every(
        (row) => row.prepared,
      ),
    preparedCount:
      tables.filter(
        (row) => row.prepared,
      ).length,
    enabledCount:
      tables.filter(
        (row) =>
          row.rowSecurityEnabled,
      ).length,
    tables,
  }
}
