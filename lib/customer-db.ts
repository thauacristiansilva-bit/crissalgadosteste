import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import {
  getCurrentDeploymentOrganizationId,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import { getTenantOrders } from "@/lib/order-db"
import type {
  CustomerAccount,
  CustomerSummary,
} from "@/lib/types"

type CustomerAccountRow = {
  id: number
  cpf_hash: string
  cpf_last4: string
  pin_hash: string
  google_subject: string | null
  name: string
  phone: string
  email: string
  default_address: string
  default_number: string
  default_district: string
  default_city: string
  default_state: string
  default_zip_code: string
  default_complement: string
  default_latitude: number | null
  default_longitude: number | null
  loyalty_points: number
  active: boolean
  created_at: Date | string
  updated_at: Date | string
}

function iso(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}

function mapAccount(row: CustomerAccountRow): CustomerAccount {
  return {
    id: Number(row.id),
    cpfHash: row.cpf_hash,
    cpfLast4: row.cpf_last4,
    pinHash: row.pin_hash,
    name: row.name,
    phone: row.phone,
    email: row.email || "",
    defaultAddress: row.default_address || "",
    defaultNumber: row.default_number || "",
    defaultDistrict: row.default_district || "",
    defaultCity: row.default_city || "",
    defaultState: row.default_state || "",
    defaultZipCode: row.default_zip_code || "",
    defaultComplement: row.default_complement || "",
    defaultLatitude:
      row.default_latitude === null
        ? null
        : Number(row.default_latitude),
    defaultLongitude:
      row.default_longitude === null
        ? null
        : Number(row.default_longitude),
    loyaltyPoints: Number(row.loyalty_points),
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

export function safeTenantCustomer(account: CustomerAccount) {
  const {
    cpfHash: _cpfHash,
    pinHash: _pinHash,
    ...safe
  } = account

  return safe
}

export function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "")
}

export function isValidCpf(cpf: string) {
  const value = normalizeCpf(cpf)

  if (
    !/^\d{11}$/.test(value) ||
    /^(\d)\1{10}$/.test(value)
  ) {
    return false
  }

  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index)
    }
    const mod = (sum * 10) % 11
    return mod === 10 ? 0 : mod
  }

  return (
    digit(9) === Number(value[9]) &&
    digit(10) === Number(value[10])
  )
}

/**
 * Compatibilidade com as contas já existentes no sistema anterior.
 * Mantemos o mesmo hash para que a migração não exija armazenar CPF puro
 * nem obrigue o cliente a recadastrar o documento.
 */
export function cpfHash(cpf: string) {
  return createHash("sha256")
    .update(`cris-cpf:${normalizeCpf(cpf)}`)
    .digest("hex")
}

function makePinHash(pin: string) {
  const salt = randomBytes(16).toString("hex")
  const digest = scryptSync(pin, salt, 32).toString("hex")
  return `${salt}:${digest}`
}

function validPin(pin: string, stored: string) {
  const [salt, digest] = stored.split(":")
  if (!salt || !digest) return false

  const actual = scryptSync(pin, salt, 32)
  const expected = Buffer.from(digest, "hex")

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  )
}

const DUMMY_PIN_HASH = `saborflow-client-dummy:${scryptSync(
  "__saborflow_invalid_pin__",
  "saborflow-client-dummy",
  32,
).toString("hex")}`

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function refreshAccountsCount(organizationId: string) {
  await getPostgresPool().query(
    `
      UPDATE sf_customers_state
      SET
        accounts_count = (
          SELECT COUNT(*)::int
          FROM sf_customer_accounts
          WHERE organization_id = $1
        ),
        updated_at = now()
      WHERE organization_id = $1
        AND ready = true
    `,
    [organizationId],
  )
}

export async function isTenantCustomersReady(
  organizationId: string,
) {
  try {
    const result = await getPostgresPool().query<{ ready: boolean }>(
      `
        SELECT ready
        FROM sf_customers_state
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

export async function getTenantCustomerAccounts(
  organizationId: string,
  options?: { includeInactive?: boolean },
) {
  const result = await getPostgresPool().query<CustomerAccountRow>(
    `
      SELECT
        id,
        cpf_hash,
        cpf_last4,
        pin_hash,
        google_subject,
        name,
        phone,
        email,
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
        created_at,
        updated_at
      FROM sf_customer_accounts
      WHERE organization_id = $1
        ${options?.includeInactive ? "" : "AND active = true"}
      ORDER BY updated_at DESC, id DESC
    `,
    [organizationId],
  )

  return result.rows.map(mapAccount)
}

export async function getTenantCustomerAccount(
  organizationId: string,
  id: number,
) {
  const result = await getPostgresPool().query<CustomerAccountRow>(
    `
      SELECT
        id,
        cpf_hash,
        cpf_last4,
        pin_hash,
        google_subject,
        name,
        phone,
        email,
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
        created_at,
        updated_at
      FROM sf_customer_accounts
      WHERE organization_id = $1
        AND id = $2
        AND active = true
      LIMIT 1
    `,
    [organizationId, id],
  )

  return result.rows[0] ? mapAccount(result.rows[0]) : null
}

export async function authenticateTenantCustomer(
  organizationId: string,
  cpf: string,
  pin: string,
) {
  const hash = cpfHash(cpf)

  const result = await getPostgresPool().query<CustomerAccountRow>(
    `
      SELECT
        id,
        cpf_hash,
        cpf_last4,
        pin_hash,
        google_subject,
        name,
        phone,
        email,
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
        created_at,
        updated_at
      FROM sf_customer_accounts
      WHERE organization_id = $1
        AND cpf_hash = $2
        AND active = true
      LIMIT 1
    `,
    [organizationId, hash],
  )

  const row = result.rows[0]
  const pinMatches = validPin(pin, row?.pin_hash || DUMMY_PIN_HASH)
  if (!row || !pinMatches) return null

  return mapAccount(row)
}

export async function createTenantCustomerAccount(
  organizationId: string,
  input: {
    cpf: string
    pin: string
    name: string
    phone: string
    email?: string
    defaultCity?: string
    defaultState?: string
  },
) {
  const cpfDigits = normalizeCpf(input.cpf)

  if (!isValidCpf(cpfDigits)) {
    throw new Error("Informe um CPF válido com 11 números.")
  }

  if (!/^\d{4,6}$/.test(input.pin)) {
    throw new Error("Crie um PIN de 4 a 6 números.")
  }

  const name = input.name.trim()
  const phone = input.phone.trim()
  const email = input.email?.trim() || ""

  if (!name || !phone) {
    throw new Error("Nome e telefone são obrigatórios.")
  }

  const client = await getPostgresPool().connect()

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`saborflow-customers:${organizationId}`],
    )

    const duplicate = await client.query(
      `
        SELECT 1
        FROM sf_customer_accounts
        WHERE organization_id = $1
          AND cpf_hash = $2
        LIMIT 1
      `,
      [organizationId, cpfHash(cpfDigits)],
    )

    if (duplicate.rowCount) {
      throw new Error("Já existe uma conta com este CPF.")
    }

    const idResult = await client.query<{ next_id: number }>(
      `
        SELECT COALESCE(MAX(id), 0)::int + 1 AS next_id
        FROM sf_customer_accounts
        WHERE organization_id = $1
      `,
      [organizationId],
    )

    const id = Number(idResult.rows[0]?.next_id || 1)

    const inserted = await client.query<CustomerAccountRow>(
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
          '', '', '', $11, $12, '', '',
          NULL, NULL, 0, true, 'cpf_pin',
          now(), now()
        )
        RETURNING
          id,
          cpf_hash,
          cpf_last4,
          pin_hash,
          google_subject,
          name,
          phone,
          email,
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
          created_at,
          updated_at
      `,
      [
        organizationId,
        id,
        cpfHash(cpfDigits),
        cpfDigits.slice(-4),
        makePinHash(input.pin),
        name,
        phone,
        normalizePhone(phone),
        email,
        normalizeEmail(email),
        input.defaultCity?.trim() || "",
        input.defaultState?.trim() || "",
      ],
    )

    await client.query("COMMIT")
    await refreshAccountsCount(organizationId)

    return mapAccount(inserted.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    const pgError = error as { code?: string }

    if (pgError?.code === "23505") {
      throw new Error("Já existe uma conta com este CPF.")
    }

    throw error
  } finally {
    client.release()
  }
}

export async function updateTenantCustomerAccount(
  organizationId: string,
  id: number,
  patch: Partial<
    Pick<
      CustomerAccount,
      | "name"
      | "phone"
      | "email"
      | "defaultAddress"
      | "defaultNumber"
      | "defaultDistrict"
      | "defaultCity"
      | "defaultState"
      | "defaultZipCode"
      | "defaultComplement"
      | "defaultLatitude"
      | "defaultLongitude"
      | "loyaltyPoints"
      | "active"
    >
  >,
) {
  const current = await getTenantCustomerAccount(organizationId, id)
  if (!current) return null

  const next = {
    ...current,
    ...patch,
  }

  const result = await getPostgresPool().query<CustomerAccountRow>(
    `
      UPDATE sf_customer_accounts
      SET
        name = $3,
        phone = $4,
        phone_normalized = $5,
        email = $6,
        email_normalized = $7,
        default_address = $8,
        default_number = $9,
        default_district = $10,
        default_city = $11,
        default_state = $12,
        default_zip_code = $13,
        default_complement = $14,
        default_latitude = $15,
        default_longitude = $16,
        loyalty_points = $17,
        active = $18,
        updated_at = now()
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id,
        cpf_hash,
        cpf_last4,
        pin_hash,
        google_subject,
        name,
        phone,
        email,
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
        created_at,
        updated_at
    `,
    [
      organizationId,
      id,
      next.name.trim(),
      next.phone.trim(),
      normalizePhone(next.phone),
      next.email.trim(),
      normalizeEmail(next.email),
      next.defaultAddress.trim(),
      next.defaultNumber.trim(),
      next.defaultDistrict.trim(),
      next.defaultCity.trim(),
      next.defaultState.trim(),
      next.defaultZipCode.trim(),
      next.defaultComplement.trim(),
      next.defaultLatitude,
      next.defaultLongitude,
      Math.max(0, Math.floor(Number(next.loyaltyPoints))),
      Boolean(next.active),
    ],
  )

  return result.rows[0] ? mapAccount(result.rows[0]) : null
}

export async function upsertTenantCustomerAccount(
  organizationId: string,
  account: CustomerAccount,
) {
  await getPostgresPool().query(
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
      ON CONFLICT (organization_id, id)
      DO UPDATE SET
        cpf_hash = EXCLUDED.cpf_hash,
        cpf_last4 = EXCLUDED.cpf_last4,
        pin_hash = EXCLUDED.pin_hash,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        phone_normalized = EXCLUDED.phone_normalized,
        email = EXCLUDED.email,
        email_normalized = EXCLUDED.email_normalized,
        default_address = EXCLUDED.default_address,
        default_number = EXCLUDED.default_number,
        default_district = EXCLUDED.default_district,
        default_city = EXCLUDED.default_city,
        default_state = EXCLUDED.default_state,
        default_zip_code = EXCLUDED.default_zip_code,
        default_complement = EXCLUDED.default_complement,
        default_latitude = EXCLUDED.default_latitude,
        default_longitude = EXCLUDED.default_longitude,
        loyalty_points = EXCLUDED.loyalty_points,
        active = EXCLUDED.active,
        updated_at = EXCLUDED.updated_at
    `,
    [
      organizationId,
      account.id,
      account.cpfHash,
      account.cpfLast4,
      account.pinHash,
      account.name,
      account.phone,
      normalizePhone(account.phone),
      account.email,
      normalizeEmail(account.email),
      account.defaultAddress,
      account.defaultNumber,
      account.defaultDistrict,
      account.defaultCity,
      account.defaultState,
      account.defaultZipCode,
      account.defaultComplement,
      account.defaultLatitude,
      account.defaultLongitude,
      Math.max(0, Math.floor(Number(account.loyaltyPoints))),
      account.active,
      account.createdAt,
      account.updatedAt,
    ],
  )

  await refreshAccountsCount(organizationId)
  return account
}

export async function syncCurrentDeploymentCustomerAccountFromLegacy(
  account: CustomerAccount,
) {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return false
  if (!(await isTenantCustomersReady(organizationId))) return false

  await upsertTenantCustomerAccount(organizationId, account)
  return true
}

export async function getCurrentDeploymentCustomerAccount(id: number) {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return null
  if (!(await isTenantCustomersReady(organizationId))) return null

  return getTenantCustomerAccount(organizationId, id)
}

export async function getTenantCustomers(
  organizationId: string,
): Promise<CustomerSummary[]> {
  const [orders, accounts] = await Promise.all([
    getTenantOrders(organizationId),
    getTenantCustomerAccounts(organizationId, {
      includeInactive: true,
    }),
  ])

  const map = new Map<string, CustomerSummary>()

  for (const order of orders) {
    if (order.status === "cancelled") continue

    const phoneKey = normalizePhone(order.customer.phone)
    const key =
      phoneKey ||
      order.customer.name.trim().toLocaleLowerCase("pt-BR")

    const current = map.get(key)

    if (!current) {
      map.set(key, {
        key,
        name: order.customer.name,
        phone: order.customer.phone,
        orders: 1,
        totalSpent: Number(order.total),
        lastOrderAt: order.createdAt,
        loyaltyPoints: 0,
        segment: "new",
        lifecycle: "active",
      })
    } else {
      current.orders += 1
      current.totalSpent = Number(
        (current.totalSpent + Number(order.total)).toFixed(2),
      )

      if (
        new Date(order.createdAt).getTime() >
        new Date(current.lastOrderAt).getTime()
      ) {
        current.lastOrderAt = order.createdAt
        current.name = order.customer.name
        current.phone = order.customer.phone
      }
    }
  }

  for (const account of accounts) {
    const phoneKey = normalizePhone(account.phone)
    const key = phoneKey || `account-${account.id}`

    const current =
      map.get(key) ||
      {
        key,
        name: account.name,
        phone: account.phone,
        orders: 0,
        totalSpent: 0,
        lastOrderAt: account.createdAt,
        loyaltyPoints: account.loyaltyPoints,
        segment: "new" as const,
        lifecycle: "never" as const,
      }

    current.name = account.name || current.name
    current.phone = account.phone || current.phone
    current.loyaltyPoints = account.loyaltyPoints
    current.cpfLast4 = account.cpfLast4
    map.set(key, current)
  }

  const now = Date.now()

  return [...map.values()]
    .map((customer) => {
      const days = Math.floor(
        (now - new Date(customer.lastOrderAt).getTime()) /
          86_400_000,
      )

      customer.segment =
        customer.orders >= 20 || customer.totalSpent >= 500
          ? "elite"
          : customer.orders >= 8
            ? "frequent"
            : customer.orders >= 2
              ? "repeat"
              : "new"

      customer.lifecycle =
        customer.orders === 0
          ? "never"
          : days <= 30
            ? "active"
            : days <= 90
              ? "sleeping"
              : "inactive"

      return customer
    })
    .sort(
      (a, b) =>
        new Date(b.lastOrderAt).getTime() -
        new Date(a.lastOrderAt).getTime(),
    )
}

export async function getTenantCustomersStats(
  organizationId: string,
) {
  const [state, count, customers] = await Promise.all([
    getPostgresPool().query<{
      ready: boolean
      source: string | null
      accounts_count: number
      imported_at: Date | string | null
    }>(
      `
        SELECT ready, source, accounts_count, imported_at
        FROM sf_customers_state
        WHERE organization_id = $1
        LIMIT 1
      `,
      [organizationId],
    ),
    getPostgresPool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sf_customer_accounts
        WHERE organization_id = $1
      `,
      [organizationId],
    ),
    getTenantCustomers(organizationId),
  ])

  const row = state.rows[0]

  return {
    ready: Boolean(row?.ready),
    source: row?.source ?? null,
    importedAt: row?.imported_at ? iso(row.imported_at) : null,
    accounts: Number(count.rows[0]?.count || 0),
    importedAccounts: Number(row?.accounts_count || 0),
    crmCustomers: customers.length,
  }
}

export async function currentDeploymentCustomersReady() {
  const organizationId = await getCurrentDeploymentOrganizationId()
  if (!organizationId) return null

  return {
    organizationId,
    ready: await isTenantCustomersReady(organizationId),
    currentDeployment: await isCurrentDeploymentOrganization(
      organizationId,
    ),
  }
}
