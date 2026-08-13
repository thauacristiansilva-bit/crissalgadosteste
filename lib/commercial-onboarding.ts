import { randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import {
  assertActiveSubscriptionForOrganization,
  assertOrganizationEntitlement,
  getBillingSnapshotForOrganization,
} from "@/lib/billing-db"
import {
  getTenantSettings,
  updateTenantSettings,
} from "@/lib/organization-db"
import type { BusinessHour, StoreSettings } from "@/lib/types"

export const COMMERCIAL_ONBOARDING_VERSION = 3

export const commercialOnboardingSteps = [
  "business",
  "brand",
  "hours",
  "fulfillment",
  "catalog",
  "publish",
] as const

export type CommercialOnboardingStep = (typeof commercialOnboardingSteps)[number]
export type CommercialOnboardingCurrentStep = CommercialOnboardingStep | "published"

export type CommercialOnboardingSnapshot = {
  schemaReady: boolean
  organization: {
    id: string
    name: string
    slug: string
    legalName: string
    industry: string
    email: string
    phone: string
    onboardingStatus: "pending" | "complete"
    publicStoreEnabled: boolean
    publicOrderingEnabled: boolean
  }
  state: {
    version: number
    currentStep: CommercialOnboardingCurrentStep
    completedSteps: CommercialOnboardingStep[]
    completed: boolean
    publishedAt: string | null
  }
  settings: StoreSettings
  catalog: {
    products: number
    activeProducts: number
  }
  billing: {
    active: boolean
    planName: string | null
    planCode: string | null
    organizationsUsed: number
    organizationsLimit: number | null
    deliveryIncluded: boolean
    registrationReview: "pending" | "approved" | "rejected"
  }
  readiness: {
    readyToPublish: boolean
    pending: string[]
  }
}

type OnboardingRow = {
  version: number
  current_step: CommercialOnboardingCurrentStep
  completed_steps: unknown
  completed_at: Date | string | null
  published_at: Date | string | null
}

function iso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function cleanText(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max)
}

function validHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function completedSteps(value: unknown): CommercialOnboardingStep[] {
  if (!Array.isArray(value)) return []
  return value
    .map(String)
    .filter((step): step is CommercialOnboardingStep =>
      commercialOnboardingSteps.includes(step as CommercialOnboardingStep),
    )
}

async function ensureOnboardingRow(organizationId: string) {
  const pool = getPostgresPool()
  await pool.query(
    `
      INSERT INTO sf_organization_onboarding (
        organization_id,
        version,
        current_step,
        completed_steps,
        started_at,
        completed_at,
        published_at,
        updated_at
      )
      SELECT
        o.id,
        $2,
        CASE WHEN o.onboarding_status = 'complete' THEN 'published' ELSE 'business' END,
        CASE
          WHEN o.onboarding_status = 'complete'
            THEN '["business","brand","hours","fulfillment","catalog","publish"]'::jsonb
          ELSE '[]'::jsonb
        END,
        o.created_at,
        CASE WHEN o.onboarding_status = 'complete' THEN COALESCE(o.onboarding_completed_at, now()) ELSE NULL END,
        CASE WHEN o.onboarding_status = 'complete' THEN COALESCE(o.onboarding_completed_at, now()) ELSE NULL END,
        now()
      FROM sf_organizations o
      WHERE o.id = $1
      ON CONFLICT (organization_id) DO NOTHING
    `,
    [organizationId, COMMERCIAL_ONBOARDING_VERSION],
  )
}

async function markStepComplete(
  organizationId: string,
  step: CommercialOnboardingStep,
  nextStep: CommercialOnboardingCurrentStep,
  userId?: string,
) {
  await getPostgresPool().query(
    `
      UPDATE sf_organization_onboarding
      SET
        completed_steps = CASE
          WHEN completed_steps ? $2
            THEN completed_steps
          ELSE completed_steps || jsonb_build_array($2::text)
        END,
        current_step = $3,
        updated_at = now()
      WHERE organization_id = $1
    `,
    [organizationId, step, nextStep],
  )

  if (userId) {
    await getPostgresPool().query(
      `
        INSERT INTO sf_audit_log (
          id, organization_id, user_id, action, entity_type, entity_id, metadata
        )
        VALUES ($1, $2, $3, 'onboarding.step.complete', 'organization', $2::uuid::text, $4::jsonb)
      `,
      [
        randomUUID(),
        organizationId,
        userId,
        JSON.stringify({ version: COMMERCIAL_ONBOARDING_VERSION, step, nextStep }),
      ],
    )
  }
}

function normalizeHours(value: unknown): BusinessHour[] {
  if (!Array.isArray(value) || value.length !== 7) {
    throw new Error("Configure os sete dias da semana.")
  }

  const rows = value.map((item, index) => {
    const row = (item || {}) as Partial<BusinessHour>
    const day = Number(row.day)
    const open = cleanText(row.open, 5)
    const close = cleanText(row.close, 5)
    const enabled = Boolean(row.enabled)
    if (day !== index || !/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) {
      throw new Error("Há um horário inválido no funcionamento da loja.")
    }
    return {
      day,
      label: cleanText(row.label, 24) || ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][day],
      enabled,
      open,
      close,
    }
  })

  if (!rows.some((row) => row.enabled)) {
    throw new Error("Habilite pelo menos um dia de funcionamento.")
  }

  return rows
}

export async function getCommercialOnboardingSnapshot(
  organizationId: string,
): Promise<CommercialOnboardingSnapshot | null> {
  try {
    await ensureOnboardingRow(organizationId)

    const [organizationResult, stateResult, settings, catalogResult, billing, registrationReviewResult] = await Promise.all([
      getPostgresPool().query<{
        id: string
        trade_name: string
        slug: string
        legal_name: string | null
        industry: string | null
        email: string | null
        phone: string | null
        onboarding_status: "pending" | "complete"
        public_store_enabled: boolean
        public_ordering_enabled: boolean
      }>(
        `
          SELECT id, trade_name, slug, legal_name, industry, email, phone,
                 onboarding_status, public_store_enabled, public_ordering_enabled
          FROM sf_organizations
          WHERE id = $1
          LIMIT 1
        `,
        [organizationId],
      ),
      getPostgresPool().query<OnboardingRow>(
        `
          SELECT version, current_step, completed_steps, completed_at, published_at
          FROM sf_organization_onboarding
          WHERE organization_id = $1
          LIMIT 1
        `,
        [organizationId],
      ),
      getTenantSettings(organizationId),
      getPostgresPool().query<{ products: number; active_products: number }>(
        `
          SELECT
            COUNT(*)::int AS products,
            COUNT(*) FILTER (WHERE active = true)::int AS active_products
          FROM sf_products
          WHERE organization_id = $1
        `,
        [organizationId],
      ),
      getBillingSnapshotForOrganization(organizationId),
      getPostgresPool().query<{ status: "pending" | "approved" | "rejected" | null }>(
        `
          SELECT r.status
          FROM sf_organizations o
          LEFT JOIN sf_platform_registration_reviews r ON r.billing_account_id = o.billing_account_id
          WHERE o.id = $1
          LIMIT 1
        `,
        [organizationId],
      ),
    ])

    const organization = organizationResult.rows[0]
    const state = stateResult.rows[0]
    if (!organization || !state || !settings) return null

    const done = completedSteps(state.completed_steps)
    const activeProducts = Number(catalogResult.rows[0]?.active_products || 0)
    const pending: string[] = []

    for (const step of ["business", "brand", "hours", "fulfillment", "catalog"] as CommercialOnboardingStep[]) {
      if (!done.includes(step)) pending.push(step)
    }
    if (activeProducts <= 0) pending.push("produto ativo")
    if (!settings.pickupEnabled && !settings.deliveryEnabled) pending.push("retirada ou entrega")
    if (!settings.acceptingOrders) pending.push("operação liberada")
    if (billing.subscription?.status !== "active") pending.push("assinatura ativa")
    const registrationReview = registrationReviewResult.rows[0]?.status || "pending"
    if (registrationReview !== "approved") pending.push("cadastro aprovado pelo SaborFlow")

    return {
      schemaReady: true,
      organization: {
        id: organization.id,
        name: organization.trade_name,
        slug: organization.slug,
        legalName: organization.legal_name || "",
        industry: organization.industry || "",
        email: organization.email || "",
        phone: organization.phone || "",
        onboardingStatus: organization.onboarding_status,
        publicStoreEnabled: Boolean(organization.public_store_enabled),
        publicOrderingEnabled: Boolean(organization.public_ordering_enabled),
      },
      state: {
        version: Number(state.version || COMMERCIAL_ONBOARDING_VERSION),
        currentStep: state.current_step,
        completedSteps: done,
        completed: organization.onboarding_status === "complete" && state.current_step === "published",
        publishedAt: iso(state.published_at),
      },
      settings,
      catalog: {
        products: Number(catalogResult.rows[0]?.products || 0),
        activeProducts,
      },
      billing: {
        active: billing.subscription?.status === "active" && billing.account?.status === "active",
        planName: billing.subscription?.planName || null,
        planCode: billing.subscription?.planCode || null,
        organizationsUsed: billing.usage.organizations,
        organizationsLimit: billing.entitlements.maxOrganizations,
        deliveryIncluded: billing.entitlements.delivery,
        registrationReview,
      },
      readiness: {
        readyToPublish: pending.length === 0,
        pending,
      },
    }
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === "42P01") return null
    throw error
  }
}

export async function saveCommercialOnboardingStep(
  organizationId: string,
  userId: string,
  step: CommercialOnboardingStep,
  data: Record<string, unknown>,
) {
  await assertActiveSubscriptionForOrganization(organizationId)
  await ensureOnboardingRow(organizationId)

  if (step === "business") {
    const storeName = cleanText(data.storeName, 120)
    const phone = cleanText(data.phone, 40)
    const email = cleanText(data.email, 180).toLowerCase()
    const legalName = cleanText(data.legalName, 180)
    const industry = cleanText(data.industry, 100)
    const address = cleanText(data.address, 180)
    const storeDistrict = cleanText(data.storeDistrict, 100)
    const city = cleanText(data.city, 100)
    const state = cleanText(data.state, 2).toUpperCase()
    const zipCode = cleanText(data.zipCode, 12)

    if (storeName.length < 2) throw new Error("Informe o nome comercial da loja.")
    if (!phone) throw new Error("Informe um telefone comercial.")
    if (!city || state.length !== 2) throw new Error("Informe cidade e UF da loja.")

    await updateTenantSettings(organizationId, {
      storeName,
      phone,
      address,
      storeDistrict,
      city,
      state,
      zipCode,
    })
    await getPostgresPool().query(
      `
        UPDATE sf_organizations
        SET legal_name = $2, industry = $3, email = $4, phone = $5, updated_at = now()
        WHERE id = $1
      `,
      [organizationId, legalName || null, industry || null, email || null, phone || null],
    )
    await markStepComplete(organizationId, "business", "brand", userId)
  } else if (step === "brand") {
    const primaryColor = cleanText(data.primaryColor, 7)
    const secondaryColor = cleanText(data.secondaryColor, 7)
    const backgroundColor = cleanText(data.backgroundColor, 7)
    if (![primaryColor, secondaryColor, backgroundColor].every(validHex)) {
      throw new Error("Use cores válidas no formato hexadecimal, como #f59e0b.")
    }
    await updateTenantSettings(organizationId, {
      slogan: cleanText(data.slogan, 140),
      welcomeTitle: cleanText(data.welcomeTitle, 160),
      welcomeText: cleanText(data.welcomeText, 420),
      primaryColor,
      secondaryColor,
      backgroundColor,
      logoImage: cleanText(data.logoImage, 800),
      coverImage: cleanText(data.coverImage, 800),
    })
    await markStepComplete(organizationId, "brand", "hours", userId)
  } else if (step === "hours") {
    const businessHours = normalizeHours(data.businessHours)
    await updateTenantSettings(organizationId, {
      businessHours,
      openingHours: "Horários configurados no SaborFlow",
    })
    await markStepComplete(organizationId, "hours", "fulfillment", userId)
  } else if (step === "fulfillment") {
    const pickupEnabled = Boolean(data.pickupEnabled)
    const deliveryEnabled = Boolean(data.deliveryEnabled)
    if (!pickupEnabled && !deliveryEnabled) {
      throw new Error("Habilite retirada ou entrega para continuar.")
    }
    if (deliveryEnabled) {
      await assertOrganizationEntitlement(organizationId, "delivery")
    }
    await updateTenantSettings(organizationId, {
      pickupEnabled,
      deliveryEnabled,
      minimumOrder: Math.max(0, Number(data.minimumOrder || 0)),
      pickupLeadMinutes: Math.max(5, Number(data.pickupLeadMinutes || 15)),
      deliveryMinMinutes: Math.max(5, Number(data.deliveryMinMinutes || 30)),
      deliveryMaxMinutes: Math.max(5, Number(data.deliveryMaxMinutes || 50)),
      acceptingOrders: true,
    })
    await markStepComplete(organizationId, "fulfillment", "catalog", userId)
  } else if (step === "catalog") {
    const result = await getPostgresPool().query<{ count: number }>(
      `SELECT COUNT(*) FILTER (WHERE active = true)::int AS count FROM sf_products WHERE organization_id = $1`,
      [organizationId],
    )
    if (Number(result.rows[0]?.count || 0) <= 0) {
      throw new Error("Cadastre pelo menos um produto ativo antes de continuar.")
    }
    await markStepComplete(organizationId, "catalog", "publish", userId)
  } else {
    throw new Error("Etapa inválida para salvamento.")
  }

  return getCommercialOnboardingSnapshot(organizationId)
}

export async function publishCommercialOnboarding(
  organizationId: string,
  userId: string,
) {
  await assertActiveSubscriptionForOrganization(organizationId)
  const snapshot = await getCommercialOnboardingSnapshot(organizationId)
  if (!snapshot) throw new Error("Onboarding comercial ainda não está disponível.")
  if (snapshot.state.completed) return snapshot
  if (!snapshot.readiness.readyToPublish) {
    throw new Error(`Conclua antes de publicar: ${snapshot.readiness.pending.join(", ")}.`)
  }

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `
        UPDATE sf_organizations
        SET
          onboarding_status = 'complete',
          onboarding_completed_at = now(),
          onboarding_version = $2,
          public_store_enabled = true,
          public_ordering_enabled = true,
          updated_at = now()
        WHERE id = $1
      `,
      [organizationId, COMMERCIAL_ONBOARDING_VERSION],
    )
    await client.query(
      `
        UPDATE sf_organization_onboarding
        SET
          completed_steps = CASE
            WHEN completed_steps ? 'publish' THEN completed_steps
            ELSE completed_steps || '["publish"]'::jsonb
          END,
          current_step = 'published',
          completed_at = now(),
          published_at = now(),
          updated_at = now()
        WHERE organization_id = $1
      `,
      [organizationId],
    )
    await client.query(
      `
        INSERT INTO sf_audit_log (
          id, organization_id, user_id, action, entity_type, entity_id, metadata
        )
        VALUES ($1, $2, $3, 'onboarding.publish', 'organization', $2::uuid::text, $4::jsonb)
      `,
      [
        randomUUID(),
        organizationId,
        userId,
        JSON.stringify({ version: COMMERCIAL_ONBOARDING_VERSION, source: "commercial-onboarding" }),
      ],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return getCommercialOnboardingSnapshot(organizationId)
}
