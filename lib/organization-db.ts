import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { demoOrganizationIsUsable } from "@/lib/demo-policy"
import { runWithRlsBypass } from "@/lib/rls-context"
import type {
  StaffMember,
  StaffRole,
  StoreSettings,
} from "@/lib/types"

export type PublicOrganization = {
  id: string
  name: string
  slug: string
  publicStoreEnabled: boolean
  publicOrderingEnabled: boolean
}

type StaffRow = {
  id: number
  name: string
  email: string
  phone: string
  role: StaffRole
  active: boolean
  permissions: string[]
  created_at: Date | string
  updated_at: Date | string
}

function iso(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function mapStaff(row: StaffRow): StaffMember {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    role: row.role,
    active: Boolean(row.active),
    permissions: Array.isArray(row.permissions)
      ? row.permissions.map(String)
      : [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function normalizeHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

export function normalizePublicDomain(value: string) {
  return normalizeHost(value)
}

export async function isTenantRuntimeReady(
  organizationId: string,
) {
  try {
    const result = await getPostgresPool().query<{
      ready: boolean
    }>(
      `
        SELECT ready
        FROM sf_tenant_runtime_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    )

    return Boolean(result.rows[0]?.ready)
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "42P01") return false
    throw error
  }
}

export async function getDefaultDeploymentOrganization():
  Promise<PublicOrganization | null> {
  // Fase 25: o domínio compartilhado da plataforma não possui tenant padrão.
  // Lojas públicas são resolvidas por slug, domínio, cookie ou referer.
  return null
}

export async function getPublicOrganizationBySlug(
  slug: string,
): Promise<PublicOrganization | null> {
  const clean = slug.trim().toLowerCase()
  if (!clean) return null

  // Resolver slug é uma operação pública de descoberta de tenant: ainda não
  // existe organization_id para formar o escopo RLS. O bypass fica restrito
  // a esta consulta de metadados e, após identificar a empresa, o restante
  // do fluxo volta a operar no escopo tenant explícito.
  const result = await runWithRlsBypass(() =>
    getPostgresPool().query<{
      id: string
      trade_name: string
      slug: string
      public_store_enabled: boolean
      public_ordering_enabled: boolean
    }>(
      `
        SELECT
          id,
          trade_name,
          slug,
          public_store_enabled,
          public_ordering_enabled
        FROM sf_organizations
        WHERE lower(slug) = lower($1)
          AND status IN ('active', 'trial')
          AND public_store_enabled = true
        LIMIT 1
      `,
      [clean],
    ),
  )

  const row = result.rows[0]
  if (!row) return null

  if (!(await runWithRlsBypass(() => demoOrganizationIsUsable(row.id)))) {
    return null
  }

  return {
    id: row.id,
    name: row.trade_name,
    slug: row.slug,
    publicStoreEnabled: Boolean(row.public_store_enabled),
    publicOrderingEnabled: Boolean(row.public_ordering_enabled),
  }
}

export async function getPublicOrganizationByDomain(
  domain: string,
): Promise<PublicOrganization | null> {
  const clean = normalizeHost(domain)
  if (!clean) return null

  try {
    const result = await runWithRlsBypass(() =>
      getPostgresPool().query<{
        id: string
        trade_name: string
        slug: string
        public_store_enabled: boolean
        public_ordering_enabled: boolean
      }>(
        `
          SELECT
            o.id,
            o.trade_name,
            o.slug,
            o.public_store_enabled,
            o.public_ordering_enabled
          FROM sf_organization_domains d
          INNER JOIN sf_organizations o
            ON o.id = d.organization_id
           AND o.status IN ('active', 'trial')
           AND o.public_store_enabled = true
          WHERE lower(d.domain) = lower($1)
            AND d.verified = true
          LIMIT 1
        `,
        [clean],
      ),
    )

    const row = result.rows[0]
    if (!row) return null

    if (!(await runWithRlsBypass(() => demoOrganizationIsUsable(row.id)))) {
      return null
    }

    return {
      id: row.id,
      name: row.trade_name,
      slug: row.slug,
      publicStoreEnabled: Boolean(row.public_store_enabled),
      publicOrderingEnabled: Boolean(row.public_ordering_enabled),
    }
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "42P01") return null
    throw error
  }
}

export async function getTenantSettings(
  organizationId: string,
): Promise<StoreSettings | null> {
  const result = await getPostgresPool().query<{
    timezone: string
    settings: StoreSettings
  }>(
    `
      SELECT timezone, settings
      FROM sf_organization_settings
      WHERE organization_id = $1
      LIMIT 1
    `,
    [organizationId],
  )

  const row = result.rows[0]
  const settings = row?.settings
  if (!settings || typeof settings !== "object") return null

  return {
    ...settings,
    systemName: "SaborFlow",
    timeZone: row.timezone || "America/Sao_Paulo",
  }
}

function normalizedSettings(
  current: StoreSettings,
  patch: Partial<StoreSettings>,
): StoreSettings {
  const next: StoreSettings = {
    ...current,
    ...patch,
    systemName: "SaborFlow",
    deliveryFee: 0,
    minimumOrder:
      patch.minimumOrder !== undefined
        ? Math.max(0, Number(patch.minimumOrder))
        : current.minimumOrder,
    estimatedMinutes:
      patch.estimatedMinutes !== undefined
        ? Math.max(1, Math.floor(Number(patch.estimatedMinutes)))
        : current.estimatedMinutes,
    deliveryMinMinutes:
      patch.deliveryMinMinutes !== undefined
        ? Math.max(5, Math.floor(Number(patch.deliveryMinMinutes)))
        : current.deliveryMinMinutes,
    deliveryMaxMinutes:
      patch.deliveryMaxMinutes !== undefined
        ? Math.max(5, Math.floor(Number(patch.deliveryMaxMinutes)))
        : current.deliveryMaxMinutes,
    pickupLeadMinutes:
      patch.pickupLeadMinutes !== undefined
        ? Math.max(5, Math.floor(Number(patch.pickupLeadMinutes)))
        : current.pickupLeadMinutes,
    slotIntervalMinutes:
      patch.slotIntervalMinutes !== undefined
        ? Math.max(5, Math.floor(Number(patch.slotIntervalMinutes)))
        : current.slotIntervalMinutes,
    schedulingDaysAhead:
      patch.schedulingDaysAhead !== undefined
        ? Math.max(
            1,
            Math.min(
              60,
              Math.floor(Number(patch.schedulingDaysAhead)),
            ),
          )
        : current.schedulingDaysAhead,
    storeLatitude:
      patch.storeLatitude !== undefined
        ? Number(patch.storeLatitude)
        : current.storeLatitude,
    storeLongitude:
      patch.storeLongitude !== undefined
        ? Number(patch.storeLongitude)
        : current.storeLongitude,
    businessHours: Array.isArray(patch.businessHours)
      ? patch.businessHours
      : current.businessHours,
    deliveryPricingMode: [
      "free",
      "fixed",
      "distance",
      "customAreas",
      "distanceBands",
    ].includes(String(patch.deliveryPricingMode))
      ? patch.deliveryPricingMode!
      : current.deliveryPricingMode,
    fixedDeliveryFee:
      patch.fixedDeliveryFee !== undefined
        ? Math.max(0, Number(patch.fixedDeliveryFee))
        : current.fixedDeliveryFee,
    distanceBaseFee:
      patch.distanceBaseFee !== undefined
        ? Math.max(0, Number(patch.distanceBaseFee))
        : current.distanceBaseFee,
    distanceFeePerKm:
      patch.distanceFeePerKm !== undefined
        ? Math.max(0, Number(patch.distanceFeePerKm))
        : current.distanceFeePerKm,
    maxDeliveryDistanceKm:
      patch.maxDeliveryDistanceKm !== undefined
        ? Math.max(0, Number(patch.maxDeliveryDistanceKm))
        : current.maxDeliveryDistanceKm,
    freeDeliveryAbove:
      patch.freeDeliveryAbove !== undefined
        ? Math.max(0, Number(patch.freeDeliveryAbove))
        : current.freeDeliveryAbove,
    deliveryDistanceBands: Array.isArray(
      patch.deliveryDistanceBands,
    )
      ? patch.deliveryDistanceBands.map((band, index) => ({
          id: String(
            band.id || `band-${Date.now()}-${index}`,
          ),
          minKm: Math.max(0, Number(band.minKm || 0)),
          maxKm: Math.max(0, Number(band.maxKm || 0)),
          fee: Math.max(0, Number(band.fee || 0)),
          active: band.active ?? true,
        }))
      : current.deliveryDistanceBands,
    rememberClientDays:
      patch.rememberClientDays !== undefined
        ? Math.max(
            1,
            Math.min(
              365,
              Math.floor(Number(patch.rememberClientDays)),
            ),
          )
        : current.rememberClientDays,
    loyaltyPointsPerReal:
      patch.loyaltyPointsPerReal !== undefined
        ? Math.max(0, Number(patch.loyaltyPointsPerReal))
        : current.loyaltyPointsPerReal,
    loyaltyRewardPoints:
      patch.loyaltyRewardPoints !== undefined
        ? Math.max(
            1,
            Math.floor(Number(patch.loyaltyRewardPoints)),
          )
        : current.loyaltyRewardPoints,
    printCopies:
      patch.printCopies !== undefined
        ? Math.max(
            1,
            Math.min(
              5,
              Math.floor(Number(patch.printCopies)),
            ),
          )
        : current.printCopies,
  }

  if (next.deliveryMaxMinutes < next.deliveryMinMinutes) {
    next.deliveryMaxMinutes = next.deliveryMinMinutes
  }

  return next
}

export async function updateTenantSettings(
  organizationId: string,
  patch: Partial<StoreSettings>,
) {
  const current = await getTenantSettings(organizationId)

  if (!current) {
    throw new Error(
      "Configurações da empresa ainda não foram inicializadas.",
    )
  }

  const settings = normalizedSettings(current, patch)

  await getPostgresPool().query(
    `
      UPDATE sf_organization_settings
      SET
        settings = $2::jsonb,
        updated_at = now()
      WHERE organization_id = $1
    `,
    [organizationId, JSON.stringify(settings)],
  )

  await getPostgresPool().query(
    `
      UPDATE sf_organizations
      SET
        trade_name = $2,
        phone = $3,
        updated_at = now()
      WHERE id = $1
    `,
    [
      organizationId,
      settings.storeName.trim() || current.storeName,
      settings.phone.trim() || null,
    ],
  )

  return settings
}

export async function getTenantStaffMembers(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  const result = await getPostgresPool().query<StaffRow>(
    `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        active,
        permissions,
        created_at,
        updated_at
      FROM sf_staff_members
      WHERE organization_id = $1
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY name ASC, id ASC
    `,
    [organizationId],
  )

  return result.rows.map(mapStaff)
}

async function nextStaffId(
  client: PoolClient,
  organizationId: string,
) {
  const result = await client.query<{ next_id: number }>(
    `
      SELECT COALESCE(MAX(id), 0)::int + 1 AS next_id
      FROM sf_staff_members
      WHERE organization_id = $1
    `,
    [organizationId],
  )

  return Number(result.rows[0]?.next_id || 1)
}

export async function createTenantStaffMember(
  organizationId: string,
  input: Pick<
    StaffMember,
    "name" | "email" | "phone" | "role" | "permissions"
  >,
) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()

  if (!name) {
    throw new Error("Informe o nome do colaborador.")
  }

  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-staff:${organizationId}`],
    )

    if (email) {
      const duplicate = await client.query(
        `
          SELECT 1
          FROM sf_staff_members
          WHERE organization_id = $1
            AND lower(email) = lower($2)
          LIMIT 1
        `,
        [organizationId, email],
      )

      if (duplicate.rowCount) {
        throw new Error(
          "Já existe um colaborador com este e-mail nesta empresa.",
        )
      }
    }

    const id = await nextStaffId(client, organizationId)

    const result = await client.query<StaffRow>(
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
          $1, $2, $3, $4, $5, $6, true,
          $7::jsonb, now(), now()
        )
        RETURNING
          id,
          name,
          email,
          phone,
          role,
          active,
          permissions,
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        name,
        email,
        phone,
        input.role,
        JSON.stringify(input.permissions || []),
      ],
    )

    await client.query("COMMIT")
    await refreshTenantRuntimeState(organizationId)

    return mapStaff(result.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")

    const pgError = error as { code?: string }
    if (pgError?.code === "23505") {
      throw new Error(
        "Já existe um colaborador com este e-mail nesta empresa.",
      )
    }

    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantStaffMember(
  organizationId: string,
  id: number,
  patch: Partial<
    Pick<
      StaffMember,
      | "name"
      | "email"
      | "phone"
      | "role"
      | "active"
      | "permissions"
    >
  >,
) {
  const current = (
    await getTenantStaffMembers(organizationId, {
      includeInactive: true,
    })
  ).find((item) => item.id === id)

  if (!current) return null

  const next = {
    ...current,
    ...patch,
    name:
      patch.name !== undefined
        ? patch.name.trim()
        : current.name,
    email:
      patch.email !== undefined
        ? patch.email.trim().toLowerCase()
        : current.email,
    phone:
      patch.phone !== undefined
        ? patch.phone.trim()
        : current.phone,
    permissions:
      patch.permissions !== undefined
        ? patch.permissions.map(String)
        : current.permissions,
  }

  if (!next.name) {
    throw new Error("Informe o nome do colaborador.")
  }

  const result = await getPostgresPool().query<StaffRow>(
    `
      UPDATE sf_staff_members
      SET
        name = $3,
        email = $4,
        phone = $5,
        role = $6,
        active = $7,
        permissions = $8::jsonb,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id,
        name,
        email,
        phone,
        role,
        active,
        permissions,
        created_at,
        updated_at
    `,
    [
      organizationId,
      id,
      next.name,
      next.email,
      next.phone,
      next.role,
      next.active,
      JSON.stringify(next.permissions),
    ],
  )

  if (
    result.rows[0] &&
    patch.active === false
  ) {
    await getPostgresPool().query(
      `
        UPDATE sf_memberships
        SET
          status = 'disabled',
          updated_at = now()
        WHERE organization_id = $1
          AND user_id = (
            SELECT user_id
            FROM sf_staff_members
            WHERE organization_id = $1
              AND id = $2
              AND user_id IS NOT NULL
            LIMIT 1
          )
          AND role <> 'owner'
      `,
      [organizationId, id],
    )
  }

  return result.rows[0]
    ? mapStaff(result.rows[0])
    : null
}

export async function getTenantDomains(
  organizationId: string,
) {
  try {
    const result = await getPostgresPool().query<{
      domain: string
      verified: boolean
      primary_domain: boolean
    }>(
      `
        SELECT
          domain,
          verified,
          primary_domain
        FROM sf_organization_domains
        WHERE organization_id = $1
        ORDER BY
          primary_domain DESC,
          verified DESC,
          domain ASC
      `,
      [organizationId],
    )

    return result.rows.map((row) => ({
      domain: row.domain,
      verified: Boolean(row.verified),
      primary: Boolean(row.primary_domain),
    }))
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "42P01") return []
    throw error
  }
}

export async function refreshTenantRuntimeState(
  organizationId: string,
) {
  await getPostgresPool().query(
    `
      UPDATE sf_tenant_runtime_state
      SET
        staff_count = (
          SELECT COUNT(*)::int
          FROM sf_staff_members
          WHERE organization_id = $1
        ),
        domains_count = (
          SELECT COUNT(*)::int
          FROM sf_organization_domains
          WHERE organization_id = $1
        ),
        updated_at = now()
      WHERE organization_id = $1
    `,
    [organizationId],
  )
}

export async function getTenantRuntimeStats(
  organizationId: string,
) {
  const [state, staff, domains] = await Promise.all([
    getPostgresPool().query<{
      ready: boolean
      source: string | null
      settings_ready: boolean
      staff_ready: boolean
      public_ready: boolean
      staff_count: number
      domains_count: number
      imported_at: Date | string | null
    }>(
      `
        SELECT
          ready,
          source,
          settings_ready,
          staff_ready,
          public_ready,
          staff_count,
          domains_count,
          imported_at
        FROM sf_tenant_runtime_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sf_staff_members
        WHERE organization_id = $1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sf_organization_domains
        WHERE organization_id = $1
      `,
      [organizationId],
    ),
  ])

  const row = state.rows[0]

  return {
    ready: Boolean(row?.ready),
    source: row?.source ?? null,
    importedAt: row?.imported_at
      ? iso(row.imported_at)
      : null,
    settingsReady: Boolean(row?.settings_ready),
    staffReady: Boolean(row?.staff_ready),
    publicReady: Boolean(row?.public_ready),
    staff: Number(staff.rows[0]?.count || 0),
    domains: Number(domains.rows[0]?.count || 0),
    importedStaff: Number(row?.staff_count || 0),
    importedDomains: Number(row?.domains_count || 0),
  }
}
