import {
  randomUUID,
} from "node:crypto"
import type { PoolClient } from "pg"
import {
  defaultBusinessHours,
} from "@/lib/operations"
import { getPostgresPool } from "@/lib/postgres"
import { reserveOrganizationSlot } from "@/lib/billing-db"
import { enterTenantRlsContext, runWithRlsBypass } from "@/lib/rls-context"
import type {
  StoreSettings,
} from "@/lib/types"
import type {
  AdminTenantContext,
} from "@/lib/tenant-context"

export type OrganizationPersonType =
  | "PF"
  | "PJ"

export type CreateOrganizationInput = {
  personType: OrganizationPersonType
  document: string
  tradeName: string
  legalName?: string
  industry?: string
  phone?: string
  email?: string
  city?: string
  state?: string
}

function digits(value: string) {
  return value.replace(/\D/g, "")
}

export function isValidCpfDocument(
  value: string,
) {
  const cpf = digits(value)

  if (
    !/^\d{11}$/.test(cpf) ||
    /^(\d)\1{10}$/.test(cpf)
  ) {
    return false
  }

  const calculate = (length: number) => {
    let sum = 0

    for (
      let index = 0;
      index < length;
      index += 1
    ) {
      sum +=
        Number(cpf[index]) *
        (length + 1 - index)
    }

    const mod = (sum * 10) % 11
    return mod === 10 ? 0 : mod
  }

  return (
    calculate(9) === Number(cpf[9]) &&
    calculate(10) === Number(cpf[10])
  )
}

export function isValidCnpjDocument(
  value: string,
) {
  const cnpj = digits(value)

  if (
    !/^\d{14}$/.test(cnpj) ||
    /^(\d)\1{13}$/.test(cnpj)
  ) {
    return false
  }

  const calculate = (
    length: 12 | 13,
  ) => {
    const weights =
      length === 12
        ? [
            5, 4, 3, 2, 9, 8, 7,
            6, 5, 4, 3, 2,
          ]
        : [
            6, 5, 4, 3, 2, 9, 8,
            7, 6, 5, 4, 3, 2,
          ]

    const sum = weights.reduce(
      (total, weight, index) =>
        total +
        Number(cnpj[index]) *
          weight,
      0,
    )

    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return (
    calculate(12) ===
      Number(cnpj[12]) &&
    calculate(13) ===
      Number(cnpj[13])
  )
}

function slugBase(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55)

  return normalized || "empresa"
}

async function uniqueSlug(
  client: PoolClient,
  tradeName: string,
) {
  const base = slugBase(tradeName)

  for (
    let suffix = 1;
    suffix <= 500;
    suffix += 1
  ) {
    const slug =
      suffix === 1
        ? base
        : `${base}-${suffix}`

    const exists = await client.query(
      `
        SELECT 1
        FROM sf_organizations
        WHERE lower(slug) = lower($1)
        LIMIT 1
      `,
      [slug],
    )

    if (!exists.rowCount) {
      return slug
    }
  }

  throw new Error(
    "Não foi possível gerar um endereço único para a empresa.",
  )
}

function starterSettings(
  input: CreateOrganizationInput,
): StoreSettings {
  const tradeName =
    input.tradeName.trim()

  return {
    storeName: tradeName,
    systemName: "SaborFlow",
    slogan: "",
    welcomeTitle:
      `Bem-vindo à ${tradeName}`,
    welcomeText:
      "Confira os produtos e serviços disponíveis.",
    phone: input.phone?.trim() || "",
    whatsapp: "",
    whatsappUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
    youtubeUrl: "",
    websiteUrl: "",
    address: "",
    storeDistrict: "",
    city: input.city?.trim() || "",
    state:
      input.state
        ?.trim()
        .toUpperCase() || "",
    zipCode: "",
    storeLatitude: 0,
    storeLongitude: 0,
    acceptingOrders: false,
    pickupEnabled: true,
    deliveryEnabled: false,
    dineInEnabled: false,
    deliveryFee: 0,
    deliveryPricingMode: "fixed",
    fixedDeliveryFee: 0,
    distanceBaseFee: 0,
    distanceFeePerKm: 0,
    maxDeliveryDistanceKm: 0,
    freeDeliveryAbove: 0,
    deliveryDistanceBands: [],
    minimumOrder: 0,
    estimatedMinutes: 30,
    deliveryMinMinutes: 30,
    deliveryMaxMinutes: 50,
    pickupLeadMinutes: 15,
    slotIntervalMinutes: 15,
    schedulingDaysAhead: 30,
    checkoutTimingVersion: 1,
    pixKey: "",
    openingHours:
      "Configure os horários da empresa",
    businessHours:
      defaultBusinessHours.map(
        (item) => ({ ...item }),
      ),
    pickupInstructions:
      "Apresente o número do pedido na retirada.",
    primaryColor: "#f59e0b",
    secondaryColor: "#2f1c13",
    backgroundColor: "#fff8ef",
    logoImage: "",
    coverImage: "",
    googleReviewUrl: "",
    googleBusinessUrl: "",
    checkoutAfterSubmit: "site",
    clientAccountsEnabled: true,
    rememberClientDays: 90,
    loyaltyEnabled: false,
    loyaltyPointsPerReal: 1,
    loyaltyRewardText: "",
    loyaltyRewardPoints: 100,
    autoPrintNewOrders: false,
    printerName: "",
    printCopies: 1,
    printKitchenTicket: true,
    printCustomerTicket: false,
    whatsappBulkEnabled: false,
    chatbotEnabled: false,
    chatbotGreeting:
      "Olá! Como podemos ajudar?",
    cashRegisterEnabled: true,
    fiscalEnabled: false,
    fiscalProviderUrl: "",
    totemEnabled: false,
    googleAnalyticsId: "",
    metaPixelId: "",
    cardEnabled: true,
    cashEnabled: true,
    pixEnabled: true,
  }
}

async function createOrganizationForUserInternal(
  userId: string,
  userEmail: string,
  input: CreateOrganizationInput,
): Promise<AdminTenantContext> {
  const personType =
    input.personType === "PF"
      ? "PF"
      : "PJ"

  const document = digits(
    input.document,
  )

  const validDocument =
    personType === "PF"
      ? isValidCpfDocument(document)
      : isValidCnpjDocument(
          document,
        )

  if (!validDocument) {
    throw new Error(
      personType === "PF"
        ? "Informe um CPF válido para a empresa individual."
        : "Informe um CNPJ válido.",
    )
  }

  const tradeName =
    input.tradeName.trim()

  if (tradeName.length < 2) {
    throw new Error(
      "Informe o nome da empresa.",
    )
  }

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const billing = await reserveOrganizationSlot(client, userId)

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [
        `saborflow-onboarding:${document}`,
      ],
    )

    const duplicate =
      await client.query(
        `
          SELECT trade_name
          FROM sf_organizations
          WHERE document = $1
          LIMIT 1
        `,
        [document],
      )

    if (duplicate.rowCount) {
      throw new Error(
        "Já existe uma empresa cadastrada com este documento.",
      )
    }

    const slug = await uniqueSlug(
      client,
      tradeName,
    )

    const organizationId =
      randomUUID()

    const settings =
      starterSettings(input)

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
          onboarding_status,
          onboarding_completed_at,
          public_store_enabled,
          public_ordering_enabled,
          created_by_user_id,
          billing_account_id,
          onboarding_version
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, 'trial',
          'pending', NULL,
          false, false, $10, $11, 3
        )
      `,
      [
        organizationId,
        personType,
        document,
        tradeName,
        input.legalName?.trim() ||
          null,
        slug,
        input.industry?.trim() ||
          null,
        input.phone?.trim() ||
          null,
        input.email?.trim() ||
          null,
        userId,
        billing.billingAccountId,
      ],
    )

    await client.query(
      `
        INSERT INTO sf_organization_onboarding (
          organization_id,
          version,
          current_step,
          completed_steps,
          started_at,
          updated_at
        )
        VALUES ($1, 3, 'business', '[]'::jsonb, now(), now())
      `,
      [organizationId],
    )

    await client.query(
      `
        INSERT INTO sf_memberships (
          id,
          organization_id,
          user_id,
          role,
          status
        )
        VALUES (
          $1, $2, $3, 'owner', 'active'
        )
      `,
      [
        randomUUID(),
        organizationId,
        userId,
      ],
    )

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
      `,
      [
        organizationId,
        JSON.stringify(settings),
      ],
    )

    await client.query(
      `
        INSERT INTO sf_catalog_state (
          organization_id,
          ready,
          source,
          categories_count,
          products_count,
          imported_at
        )
        VALUES (
          $1, true, 'onboarding',
          0, 0, now()
        )
      `,
      [organizationId],
    )

    await client.query(
      `
        INSERT INTO sf_orders_state (
          organization_id,
          ready,
          source,
          orders_count,
          items_count,
          total_amount,
          imported_at
        )
        VALUES (
          $1, true, 'onboarding',
          0, 0, 0, now()
        )
      `,
      [organizationId],
    )

    await client.query(
      `
        INSERT INTO sf_customers_state (
          organization_id,
          ready,
          source,
          accounts_count,
          imported_at
        )
        VALUES (
          $1, true, 'onboarding',
          0, now()
        )
      `,
      [organizationId],
    )

    await client.query(
      `
        INSERT INTO sf_operations_state (
          organization_id,
          ready,
          source,
          coupons_count,
          feedbacks_count,
          cash_sessions_count,
          financial_entries_count,
          delivery_zones_count,
          couriers_count,
          imported_at
        )
        VALUES (
          $1, true, 'onboarding',
          0, 0, 0, 0, 0, 0, now()
        )
      `,
      [organizationId],
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
          imported_at
        )
        VALUES (
          $1, true, 'onboarding',
          true, true, true,
          0, 0, now()
        )
      `,
      [organizationId],
    )

    await client.query("SAVEPOINT sf_food_state_optional")
    try {
      await client.query(
        `
          INSERT INTO sf_food_composition_state (
            organization_id,
            ready,
            source,
            modifier_groups_count,
            modifier_options_count,
            ingredients_count,
            recipe_items_count,
            imported_at
          )
          VALUES (
            $1, true, 'onboarding',
            0, 0, 0, 0, now()
          )
        `,
        [organizationId],
      )
      await client.query("RELEASE SAVEPOINT sf_food_state_optional")
    } catch (foodStateError) {
      await client.query("ROLLBACK TO SAVEPOINT sf_food_state_optional")
      await client.query("RELEASE SAVEPOINT sf_food_state_optional")
      if ((foodStateError as { code?: string })?.code !== "42P01") {
        throw foodStateError
      }
      // Janela segura entre o deploy do código e a migration 010.
      // A própria migration cria o estado para organizações já existentes.
    }

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
          'organization.create',
          'organization',
          $2::uuid::text,
          $4::jsonb
        )
      `,
      [
        randomUUID(),
        organizationId,
        userId,
        JSON.stringify({
          slug,
          personType,
          industry:
            input.industry?.trim() ||
            null,
          source:
            "commercial-onboarding-v3",
        }),
      ],
    )

    const sessionResult = await client.query<{ session_version: number }>(
      `
        SELECT session_version
        FROM sf_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    )

    const sessionVersion = Number(
      sessionResult.rows[0]?.session_version || 1,
    )

    await client.query("COMMIT")

    return {
      userId,
      email: userEmail,
      organizationId,
      organizationName:
        tradeName,
      organizationSlug: slug,
      role: "owner",
      sessionVersion,
    }
  } catch (error) {
    await client.query("ROLLBACK")

    const pgError = error as {
      code?: string
    }

    if (pgError?.code === "23505") {
      throw new Error(
        "Já existe um cadastro com esses dados.",
      )
    }

    if (pgError?.code === "42P01") {
      throw new Error(
        "A migration 014_commercial_onboarding ainda precisa ser aplicada antes de criar uma nova loja.",
      )
    }

    throw error
  } finally {
    client.release()
  }
}

export async function createOrganizationForUser(
  userId: string,
  userEmail: string,
  input: CreateOrganizationInput,
): Promise<AdminTenantContext> {
  const context = await runWithRlsBypass(() =>
    createOrganizationForUserInternal(userId, userEmail, input),
  )

  enterTenantRlsContext(
    context.organizationId,
    context.userId,
    "tenant-session",
  )

  return context
}

export async function getOrganizationOrderingReadiness(
  organizationId: string,
) {
  const result =
    await getPostgresPool().query<{
      public_store_enabled: boolean
      public_ordering_enabled: boolean
      runtime_ready: boolean
      catalog_ready: boolean
      orders_ready: boolean
      operations_ready: boolean
      customers_ready: boolean
      active_products: number
      settings: StoreSettings | null
    }>(
      `
        SELECT
          o.public_store_enabled,
          o.public_ordering_enabled,
          COALESCE(
            (SELECT ready
             FROM sf_tenant_runtime_state
             WHERE organization_id = o.id),
            false
          ) AS runtime_ready,
          COALESCE(
            (SELECT ready
             FROM sf_catalog_state
             WHERE organization_id = o.id),
            false
          ) AS catalog_ready,
          COALESCE(
            (SELECT ready
             FROM sf_orders_state
             WHERE organization_id = o.id),
            false
          ) AS orders_ready,
          COALESCE(
            (SELECT ready
             FROM sf_operations_state
             WHERE organization_id = o.id),
            false
          ) AS operations_ready,
          COALESCE(
            (SELECT ready
             FROM sf_customers_state
             WHERE organization_id = o.id),
            false
          ) AS customers_ready,
          (
            SELECT COUNT(*)::int
            FROM sf_products
            WHERE organization_id = o.id
              AND active = true
          ) AS active_products,
          (
            SELECT settings
            FROM sf_organization_settings
            WHERE organization_id = o.id
          ) AS settings
        FROM sf_organizations o
        WHERE o.id = $1
        LIMIT 1
      `,
      [organizationId],
    )

  const row = result.rows[0]

  if (!row) {
    throw new Error(
      "Empresa não encontrada.",
    )
  }

  const settings =
    row.settings &&
    typeof row.settings === "object"
      ? row.settings
      : null

  const channelsReady =
    Boolean(
      settings?.pickupEnabled ||
        settings?.deliveryEnabled,
    )

  const acceptingOrders =
    Boolean(
      settings?.acceptingOrders,
    )

  const ready =
    Boolean(
      row.public_store_enabled &&
        row.runtime_ready &&
        row.catalog_ready &&
        row.orders_ready &&
        row.operations_ready &&
        row.customers_ready &&
        row.active_products > 0 &&
        channelsReady &&
        acceptingOrders,
    )

  return {
    ready,
    publicStoreEnabled:
      Boolean(
        row.public_store_enabled,
      ),
    publicOrderingEnabled:
      Boolean(
        row.public_ordering_enabled,
      ),
    runtimeReady:
      Boolean(row.runtime_ready),
    catalogReady:
      Boolean(row.catalog_ready),
    ordersReady:
      Boolean(row.orders_ready),
    operationsReady:
      Boolean(row.operations_ready),
    customersReady:
      Boolean(row.customers_ready),
    activeProducts:
      Number(
        row.active_products || 0,
      ),
    channelsReady,
    acceptingOrders,
  }
}

export async function setOrganizationOrderingEnabled(
  organizationId: string,
  enabled: boolean,
) {
  const readiness =
    await getOrganizationOrderingReadiness(
      organizationId,
    )

  if (enabled && !readiness.ready) {
    const pending: string[] = []

    if (!readiness.runtimeReady) {
      pending.push("configurações")
    }
    if (!readiness.catalogReady) {
      pending.push("catálogo")
    }
    if (!readiness.ordersReady) {
      pending.push("pedidos")
    }
    if (!readiness.operationsReady) {
      pending.push("operação")
    }
    if (!readiness.customersReady) {
      pending.push("clientes")
    }
    if (
      readiness.activeProducts <= 0
    ) {
      pending.push(
        "ao menos um produto ativo",
      )
    }
    if (!readiness.channelsReady) {
      pending.push(
        "retirada ou entrega",
      )
    }
    if (!readiness.acceptingOrders) {
      pending.push(
        "aceitar pedidos nas configurações",
      )
    }

    throw new Error(
      `Antes de ativar pedidos online, configure: ${pending.join(
        ", ",
      )}.`,
    )
  }

  await getPostgresPool().query(
    `
      UPDATE sf_organizations
      SET
        public_ordering_enabled = $2,
        updated_at = now()
      WHERE id = $1
    `,
    [organizationId, enabled],
  )

  return {
    ...readiness,
    publicOrderingEnabled:
      enabled,
  }
}
