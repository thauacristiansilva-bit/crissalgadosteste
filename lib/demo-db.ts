import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { defaultBusinessHours } from "@/lib/operations"
import type { AdminTenantContext } from "@/lib/tenant-context"
import { expireDemoOrganizationIfNeeded } from "@/lib/demo-policy"

export type DemoEnvironmentKind = "public" | "trial"

export type DemoLaunch = {
  environmentId: string
  kind: DemoEnvironmentKind
  expiresAt: string
  organization: {
    id: string
    name: string
    slug: string
  }
  tenantContext: AdminTenantContext
  reused: boolean
}

const DEMO_PLAN_CODE = "demo-sandbox"
const PUBLIC_DEMO_MINUTES = 45
const TRIAL_DEMO_DAYS = 7

function publicMinutes() {
  const value = Number(process.env.DEMO_PUBLIC_MINUTES || PUBLIC_DEMO_MINUTES)
  return Number.isFinite(value) ? Math.max(15, Math.min(180, Math.floor(value))) : PUBLIC_DEMO_MINUTES
}

function trialDays() {
  const value = Number(process.env.DEMO_TRIAL_DAYS || TRIAL_DEMO_DAYS)
  return Number.isFinite(value) ? Math.max(1, Math.min(30, Math.floor(value))) : TRIAL_DEMO_DAYS
}

function demoSettings(storeName: string) {
  return {
    storeName,
    systemName: "SaborFlow",
    slogan: "Ambiente demonstrativo · dados fictícios",
    welcomeTitle: "Peça, acompanhe e teste o fluxo completo",
    welcomeText: "Este ambiente é temporário. Todos os dados são fictícios e integrações externas reais ficam bloqueadas.",
    phone: "(11) 99999-0000",
    whatsapp: "",
    whatsappUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
    youtubeUrl: "",
    websiteUrl: "",
    address: "Av. Demonstração, 100",
    storeDistrict: "Centro",
    city: "São Paulo",
    state: "SP",
    zipCode: "01000-000",
    storeLatitude: -23.55052,
    storeLongitude: -46.633308,
    acceptingOrders: true,
    pickupEnabled: true,
    deliveryEnabled: true,
    dineInEnabled: false,
    deliveryFee: 0,
    deliveryPricingMode: "distanceBands",
    fixedDeliveryFee: 6,
    distanceBaseFee: 4,
    distanceFeePerKm: 1.5,
    maxDeliveryDistanceKm: 10,
    freeDeliveryAbove: 80,
    deliveryDistanceBands: [
      { id: "demo-0-3", minKm: 0, maxKm: 3, fee: 5, active: true },
      { id: "demo-3-6", minKm: 3.01, maxKm: 6, fee: 8, active: true },
      { id: "demo-6-10", minKm: 6.01, maxKm: 10, fee: 12, active: true },
    ],
    minimumOrder: 0,
    estimatedMinutes: 30,
    deliveryMinMinutes: 30,
    deliveryMaxMinutes: 50,
    pickupLeadMinutes: 15,
    slotIntervalMinutes: 15,
    schedulingDaysAhead: 14,
    checkoutTimingVersion: 1,
    pixKey: "",
    openingHours: "Todos os dias · 08:00 às 23:00",
    businessHours: defaultBusinessHours.map((item) => ({ ...item, enabled: true, open: "08:00", close: "23:00" })),
    pickupInstructions: "Retire no balcão informando o número do pedido.",
    primaryColor: "#f59e0b",
    secondaryColor: "#2f1c13",
    backgroundColor: "#fff8ef",
    logoImage: "",
    coverImage: "",
    googleReviewUrl: "",
    googleBusinessUrl: "",
    checkoutAfterSubmit: "site",
    clientAccountsEnabled: true,
    rememberClientDays: 7,
    loyaltyEnabled: true,
    loyaltyPointsPerReal: 1,
    loyaltyRewardText: "100 pontos = benefício demonstrativo",
    loyaltyRewardPoints: 100,
    autoPrintNewOrders: false,
    printerName: "",
    printCopies: 1,
    printKitchenTicket: true,
    printCustomerTicket: false,
    whatsappBulkEnabled: false,
    chatbotEnabled: true,
    chatbotGreeting: "Olá! Este é o assistente da demonstração SaborFlow.",
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

async function seedDemoData(client: PoolClient, organizationId: string) {
  const now = new Date()
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

  await client.query(`
    INSERT INTO sf_categories (organization_id, id, name, active, sort_order)
    VALUES
      ($1, 1, 'Lanches', true, 1),
      ($1, 2, 'Bebidas', true, 2),
      ($1, 3, 'Sobremesas', true, 3)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_products (
      organization_id, id, category_id, name, description, price,
      active, featured, image, track_stock, stock, min_stock
    ) VALUES
      ($1, 1, 1, 'X-Burger Artesanal', 'Pão, carne, queijo e molho da casa.', 18.90, true, true, '', false, 30, 5),
      ($1, 2, 1, 'X-Bacon Especial', 'Carne, queijo, bacon crocante e molho.', 24.90, true, true, '', false, 24, 5),
      ($1, 3, 1, 'Batata Crocante', 'Porção individual de batata frita.', 15.00, true, false, '', false, 40, 8),
      ($1, 4, 2, 'Refrigerante Lata', '350 ml · escolha o sabor no balcão.', 7.50, true, false, '', false, 60, 10),
      ($1, 5, 3, 'Açaí 400 ml', 'Açaí cremoso com acompanhamentos.', 20.00, true, true, '', false, 20, 4)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_modifier_groups (
      organization_id, id, name, description, required, min_select, max_select,
      included_quantity, active, sort_order
    ) VALUES
      ($1, 1, 'Extras do lanche', 'Adicione extras ao seu lanche.', false, 0, 3, 0, true, 1),
      ($1, 2, 'Acompanhamentos do açaí', 'Escolha até 2 acompanhamentos grátis.', false, 0, 3, 2, true, 2)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_modifier_options (
      organization_id, id, group_id, name, description, price_delta,
      included_eligible, active, sort_order
    ) VALUES
      ($1, 1, 1, 'Bacon extra', '', 4.00, false, true, 1),
      ($1, 2, 1, 'Queijo extra', '', 3.00, false, true, 2),
      ($1, 3, 1, 'Carne extra', '', 7.00, false, true, 3),
      ($1, 4, 2, 'Granola', '', 0.00, true, true, 1),
      ($1, 5, 2, 'Leite em pó', '', 0.00, true, true, 2),
      ($1, 6, 2, 'Paçoca', '', 2.00, true, true, 3)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_product_modifier_groups (organization_id, product_id, group_id, sort_order)
    VALUES ($1, 1, 1, 1), ($1, 2, 1, 1), ($1, 5, 2, 1)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_ingredients (
      organization_id, id, name, unit, stock_quantity, min_stock_quantity, unit_cost, active
    ) VALUES
      ($1, 1, 'Pão brioche', 'unit', 80, 20, 1.20, true),
      ($1, 2, 'Hambúrguer 120g', 'unit', 55, 15, 5.40, true),
      ($1, 3, 'Queijo', 'portion', 70, 20, 1.80, true),
      ($1, 4, 'Bacon', 'portion', 42, 12, 2.30, true),
      ($1, 5, 'Batata congelada', 'kg', 12.500, 3.000, 13.90, true),
      ($1, 6, 'Açaí', 'kg', 9.000, 2.000, 18.50, true)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_product_ingredients (organization_id, product_id, ingredient_id, quantity)
    VALUES
      ($1, 1, 1, 1), ($1, 1, 2, 1), ($1, 1, 3, 1),
      ($1, 2, 1, 1), ($1, 2, 2, 1), ($1, 2, 3, 1), ($1, 2, 4, 1),
      ($1, 3, 5, 0.250), ($1, 5, 6, 0.400)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_modifier_option_ingredients (organization_id, option_id, ingredient_id, quantity)
    VALUES
      ($1, 1, 4, 1),
      ($1, 2, 3, 1),
      ($1, 3, 2, 1)
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_customer_accounts (
      organization_id, id, cpf_hash, cpf_last4, pin_hash, name, phone,
      phone_normalized, email, email_normalized, default_address,
      default_number, default_district, default_city, default_state,
      default_zip_code, loyalty_points, active, auth_provider, created_at, updated_at
    ) VALUES
      ($1, 1, 'demo-cpf-1', '0001', 'demo-pin-1', 'Mariana Demo', '(11) 90000-0001', '11900000001', 'mariana@example.invalid', 'mariana@example.invalid', 'Rua das Flores', '10', 'Centro', 'São Paulo', 'SP', '01000-001', 82, true, 'cpf_pin', $2, $2),
      ($1, 2, 'demo-cpf-2', '0002', 'demo-pin-2', 'Carlos Demo', '(11) 90000-0002', '11900000002', 'carlos@example.invalid', 'carlos@example.invalid', 'Av. Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP', '01310-100', 145, true, 'cpf_pin', $2, $2),
      ($1, 3, 'demo-cpf-3', '0003', 'demo-pin-3', 'Ana Demo', '(11) 90000-0003', '11900000003', 'ana@example.invalid', 'ana@example.invalid', 'Rua Augusta', '250', 'Consolação', 'São Paulo', 'SP', '01305-000', 36, true, 'cpf_pin', $2, $2)
  `, [organizationId, ago(1440)])

  await client.query(`
    INSERT INTO sf_couriers (organization_id, id, name, phone, vehicle, active, created_at, updated_at)
    VALUES
      ($1, 1, 'João Entregador', '(11) 98888-1001', 'Moto', true, $2, $2),
      ($1, 2, 'Paula Entregadora', '(11) 98888-1002', 'Moto', true, $2, $2)
  `, [organizationId, ago(1440)])

  await client.query(`
    INSERT INTO sf_staff_members (
      organization_id, id, name, email, phone, role, active, permissions, created_at, updated_at
    ) VALUES
      ($1, 1, 'Lucas Cozinha', 'cozinha@example.invalid', '', 'kitchen', true, '[]'::jsonb, $2, $2),
      ($1, 2, 'Fernanda Caixa', 'caixa@example.invalid', '', 'cashier', true, '[]'::jsonb, $2, $2)
  `, [organizationId, ago(1440)])

  await client.query(`
    INSERT INTO sf_coupons (
      organization_id, id, code, description, type, value, minimum_order,
      active, expires_at, created_at, updated_at
    ) VALUES
      ($1, 1, 'DEMO10', '10% de desconto para testar cupons.', 'percent', 10, 20, true, $2, $3, $3),
      ($1, 2, 'FRETE5', 'R$ 5 de desconto demonstrativo.', 'fixed', 5, 30, true, $2, $3, $3)
  `, [organizationId, new Date(now.getTime() + 30 * 24 * 60 * 60_000), ago(1440)])

  await client.query(`
    INSERT INTO sf_cash_sessions (
      organization_id, id, opened_at, opened_by, opening_amount, notes
    ) VALUES ($1, 1, $2, 'Fernanda Caixa', 120.00, 'Caixa demonstrativo')
  `, [organizationId, ago(240)])

  await client.query(`
    INSERT INTO sf_financial_entries (organization_id, id, type, category, description, amount, created_at)
    VALUES
      ($1, 1, 'expense', 'Embalagens', 'Compra demonstrativa de embalagens', 45.00, $2),
      ($1, 2, 'expense', 'Gás', 'Reposição demonstrativa', 90.00, $3),
      ($1, 3, 'income', 'Outras receitas', 'Ajuste demonstrativo', 25.00, $4)
  `, [organizationId, ago(180), ago(720), ago(60)])

  const orders = [
    { id: 1, status: 'pending', type: 'delivery', customer: { name: 'Mariana Demo', phone: '(11) 90000-0001', address: 'Rua das Flores, 10', district: 'Centro', city: 'São Paulo', state: 'SP', zipCode: '01000-001' }, courier: null, age: 5 },
    { id: 2, status: 'accepted', type: 'pickup', customer: { name: 'Carlos Demo', phone: '(11) 90000-0002' }, courier: null, age: 12 },
    { id: 3, status: 'preparing', type: 'delivery', customer: { name: 'Ana Demo', phone: '(11) 90000-0003', address: 'Rua Augusta, 250', district: 'Consolação', city: 'São Paulo', state: 'SP', zipCode: '01305-000' }, courier: null, age: 20 },
    { id: 4, status: 'ready', type: 'pickup', customer: { name: 'Mariana Demo', phone: '(11) 90000-0001' }, courier: null, age: 35 },
    { id: 5, status: 'in-route', type: 'delivery', customer: { name: 'Carlos Demo', phone: '(11) 90000-0002', address: 'Av. Paulista, 1000', district: 'Bela Vista', city: 'São Paulo', state: 'SP', zipCode: '01310-100' }, courier: { id: 1, name: 'João Entregador' }, age: 45 },
    { id: 6, status: 'completed', type: 'delivery', customer: { name: 'Ana Demo', phone: '(11) 90000-0003', address: 'Rua Augusta, 250', district: 'Consolação', city: 'São Paulo', state: 'SP', zipCode: '01305-000' }, courier: { id: 2, name: 'Paula Entregadora' }, age: 180 },
  ]

  for (const order of orders) {
    const created = ago(order.age)
    const deliveryFee = order.type === 'delivery' ? 5 : 0
    const subtotal = order.id % 2 === 0 ? 33.90 : 24.90
    const total = subtotal + deliveryFee
    await client.query(`
      INSERT INTO sf_orders (
        organization_id, id, code, reference, type, status, channel,
        subtotal, discount, delivery_fee, total, payment_status, payment_method,
        notes, customer, courier_id, courier_name, requested_for, scheduled,
        source, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, 0, $9, $10, $11, $12,
        $13, $14::jsonb, $15, $16, $17, false,
        'demo-seed', $17, $17
      )
    `, [
      organizationId,
      order.id,
      `D${String(order.id).padStart(3, '0')}`,
      `DEMO-${String(order.id).padStart(4, '0')}`,
      order.type,
      order.status,
      order.id === 2 ? 'PDV' : 'WEB',
      subtotal,
      deliveryFee,
      total,
      order.status === 'pending' ? 'unpaid' : 'paid',
      order.id % 2 === 0 ? 'pix' : 'card',
      'Pedido fictício da demonstração.',
      JSON.stringify(order.customer),
      order.courier?.id || null,
      order.courier?.name || null,
      created,
    ])

    await client.query(`
      INSERT INTO sf_order_items (
        organization_id, order_id, line_no, product_id, name, quantity, unit_price, subtotal
      ) VALUES ($1, $2, 1, $3, $4, 1, $5, $5)
    `, [
      organizationId,
      order.id,
      order.id % 2 === 0 ? 1 : 2,
      order.id % 2 === 0 ? 'X-Burger Artesanal' : 'X-Bacon Especial',
      subtotal,
    ])
  }

  await client.query(`
    INSERT INTO sf_inventory_movements (
      organization_id, ingredient_id, kind, quantity_delta, unit_cost_snapshot, source_key, note, created_at
    ) VALUES
      ($1, 5, 'manual_in', 5.000, 13.9000, 'demo-in-1', 'Entrada demonstrativa', $2),
      ($1, 4, 'waste', -1.000, 2.3000, 'demo-waste-1', 'Perda demonstrativa', $3)
  `, [organizationId, ago(600), ago(300)])

  await client.query(`
    INSERT INTO sf_catalog_state (
      organization_id, ready, source, categories_count, products_count, imported_at, updated_at
    ) VALUES ($1, true, 'demo-phase-16', 3, 5, now(), now())
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_orders_state (
      organization_id, ready, source, orders_count, items_count, total_amount, imported_at, updated_at
    ) VALUES ($1, true, 'demo-phase-16', 6, 6, 196.40, now(), now())
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_customers_state (
      organization_id, ready, source, accounts_count, imported_at, updated_at
    ) VALUES ($1, true, 'demo-phase-16', 3, now(), now())
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_operations_state (
      organization_id, ready, source, coupons_count, feedbacks_count,
      cash_sessions_count, financial_entries_count, delivery_zones_count,
      couriers_count, imported_at, updated_at
    ) VALUES ($1, true, 'demo-phase-16', 2, 0, 1, 3, 0, 2, now(), now())
  `, [organizationId])

  await client.query(`
    INSERT INTO sf_food_composition_state (
      organization_id, ready, source, modifier_groups_count,
      modifier_options_count, ingredients_count, recipe_items_count,
      imported_at, updated_at
    ) VALUES ($1, true, 'demo-phase-16', 2, 6, 6, 9, now(), now())
  `, [organizationId])
}

async function findReusableTrial(client: PoolClient, requestedByUserId: string) {
  const result = await client.query<{
    environment_id: string
    organization_id: string
    trade_name: string
    slug: string
    admin_user_id: string
    email: string
    session_version: number
    expires_at: Date | string
  }>(`
    SELECT
      d.id AS environment_id,
      d.organization_id,
      o.trade_name,
      o.slug,
      d.admin_user_id,
      u.email,
      u.session_version,
      d.expires_at
    FROM sf_demo_environments d
    INNER JOIN sf_organizations o ON o.id = d.organization_id
    INNER JOIN sf_users u ON u.id = d.admin_user_id
    WHERE d.kind = 'trial'
      AND d.requested_by_user_id = $1
      AND d.status = 'active'
      AND d.expires_at > now()
      AND o.status = 'trial'
    ORDER BY d.created_at DESC
    LIMIT 1
  `, [requestedByUserId])

  const row = result.rows[0]
  if (!row) return null

  await client.query(`
    UPDATE sf_demo_environments
    SET last_seen_at = now(), updated_at = now()
    WHERE id = $1
  `, [row.environment_id])

  return {
    environmentId: row.environment_id,
    kind: "trial" as const,
    expiresAt: new Date(row.expires_at).toISOString(),
    organization: {
      id: row.organization_id,
      name: row.trade_name,
      slug: row.slug,
    },
    tenantContext: {
      userId: row.admin_user_id,
      email: row.email,
      organizationId: row.organization_id,
      organizationName: row.trade_name,
      organizationSlug: row.slug,
      role: "owner" as const,
      sessionVersion: Number(row.session_version || 1),
    },
    reused: true,
  }
}

export async function expireDueDemoEnvironments() {
  const result = await getPostgresPool().query<{ organization_id: string }>(`
    SELECT organization_id
    FROM sf_demo_environments
    WHERE status = 'active'
      AND expires_at <= now()
    ORDER BY expires_at ASC
    LIMIT 250
  `).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "42P01") return { rows: [] as Array<{ organization_id: string }> }
    throw error
  })

  let expired = 0
  for (const row of result.rows) {
    if (await expireDemoOrganizationIfNeeded(row.organization_id)) expired += 1
  }
  return expired
}

export async function createDemoEnvironment(input: {
  kind: DemoEnvironmentKind
  requestedByUserId?: string | null
  requestFingerprint?: string | null
}): Promise<DemoLaunch> {
  await expireDueDemoEnvironments()

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")

    if (input.kind === "public") {
      const activeCapacity = await client.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM sf_demo_environments
        WHERE kind = 'public'
          AND status = 'active'
          AND expires_at > now()
      `)
      if (Number(activeCapacity.rows[0]?.count || 0) >= 150) {
        throw new Error("A demonstração pública atingiu a capacidade temporária. Tente novamente em alguns minutos.")
      }

      if (input.requestFingerprint) {
        const recent = await client.query<{ count: string }>(`
          SELECT COUNT(*)::text AS count
          FROM sf_demo_environments
          WHERE kind = 'public'
            AND created_at > now() - interval '1 hour'
            AND metadata ->> 'requestFingerprint' = $1
        `, [input.requestFingerprint])
        if (Number(recent.rows[0]?.count || 0) >= 4) {
          throw new Error("Muitas demonstrações foram iniciadas recentemente nesta conexão. Aguarde antes de criar outra.")
        }
      }
    }

    if (input.kind === "trial" && input.requestedByUserId) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`saborflow-demo-trial:${input.requestedByUserId}`])
      const reusable = await findReusableTrial(client, input.requestedByUserId)
      if (reusable) {
        await client.query("COMMIT")
        return reusable
      }
    }

    const plan = await client.query<{ id: string }>(`
      SELECT id FROM sf_plans
      WHERE code = $1 AND active = true AND internal = true
      LIMIT 1
    `, [DEMO_PLAN_CODE])
    const planId = plan.rows[0]?.id
    if (!planId) throw new Error("A migration da Fase 16 ainda não foi aplicada.")

    const environmentId = randomUUID()
    const organizationId = randomUUID()
    const adminUserId = randomUUID()
    const billingAccountId = randomUUID()
    const subscriptionId = randomUUID()
    const membershipId = randomUUID()
    const slug = `demo-${environmentId.replace(/-/g, "").slice(0, 12)}`
    const storeName = input.kind === "public" ? "SaborFlow Demo" : "Meu Restaurante · Trial"
    const email = `demo+${environmentId.replace(/-/g, "")}@example.invalid`
    const durationMs = input.kind === "public"
      ? publicMinutes() * 60_000
      : trialDays() * 24 * 60 * 60_000
    const expiresAt = new Date(Date.now() + durationMs)

    await client.query(`
      INSERT INTO sf_users (
        id, name, email, status, session_version, password_updated_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'active', 1, now(), now(), now())
    `, [adminUserId, input.kind === "public" ? "Visitante Demo" : "Usuário Trial", email])

    await client.query(`
      INSERT INTO sf_billing_accounts (
        id, owner_user_id, status, billing_email, entitlement_overrides, metadata, onboarding_unlocked_at
      ) VALUES ($1, $2, 'active', $3, '{}'::jsonb, $4::jsonb, now())
    `, [billingAccountId, adminUserId, email, JSON.stringify({ demo: true, environmentId, kind: input.kind })])

    await client.query(`
      INSERT INTO sf_subscriptions (
        id, billing_account_id, plan_id, status, billing_cycle, provider,
        current_period_start, current_period_end, trial_ends_at, activated_at,
        metadata, provider_status, last_provider_sync_at
      ) VALUES (
        $1, $2, $3, 'active', 'manual', 'internal-demo',
        now(), $4, $4, now(), $5::jsonb, 'demo-active', now()
      )
    `, [subscriptionId, billingAccountId, planId, expiresAt, JSON.stringify({ demo: true, environmentId, kind: input.kind })])

    await client.query(`
      INSERT INTO sf_organizations (
        id, person_type, document, trade_name, legal_name, slug, industry,
        phone, email, status, onboarding_status, onboarding_completed_at,
        public_store_enabled, public_ordering_enabled, created_by_user_id,
        onboarding_version, billing_account_id, created_at, updated_at
      ) VALUES (
        $1, 'PJ', NULL, $2, NULL, $3, 'Alimentação',
        '(11) 99999-0000', $4, 'trial', 'complete', now(),
        true, true, $5, 3, $6, now(), now()
      )
    `, [organizationId, storeName, slug, email, adminUserId, billingAccountId])

    await client.query(`
      INSERT INTO sf_memberships (
        id, organization_id, user_id, role, status, accepted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'owner', 'active', now(), now(), now())
    `, [membershipId, organizationId, adminUserId])

    await client.query(`
      INSERT INTO sf_organization_settings (
        organization_id, timezone, locale, currency, settings, created_at, updated_at
      ) VALUES ($1, 'America/Sao_Paulo', 'pt-BR', 'BRL', $2::jsonb, now(), now())
    `, [organizationId, JSON.stringify(demoSettings(storeName))])

    await client.query(`
      INSERT INTO sf_tenant_runtime_state (
        organization_id, ready, source, settings_ready, staff_ready, public_ready,
        staff_count, domains_count, imported_at, updated_at
      ) VALUES ($1, true, 'demo-phase-16', true, true, true, 2, 0, now(), now())
    `, [organizationId])

    await client.query(`
      INSERT INTO sf_organization_onboarding (
        organization_id, version, current_step, completed_steps,
        started_at, completed_at, published_at, updated_at
      ) VALUES (
        $1, 3, 'published',
        '["business","brand","hours","fulfillment","catalog","publish"]'::jsonb,
        now(), now(), now(), now()
      )
    `, [organizationId])

    await client.query(`
      INSERT INTO sf_demo_environments (
        id, kind, status, organization_id, admin_user_id, billing_account_id,
        requested_by_user_id, seed_version, started_at, expires_at, last_seen_at,
        metadata, created_at, updated_at
      ) VALUES (
        $1, $2, 'active', $3, $4, $5, $6, 1, now(), $7, now(),
        $8::jsonb, now(), now()
      )
    `, [
      environmentId,
      input.kind,
      organizationId,
      adminUserId,
      billingAccountId,
      input.requestedByUserId || null,
      expiresAt,
      JSON.stringify({
        phase: 16,
        isolated: true,
        externalEffects: false,
        ...(input.requestFingerprint ? { requestFingerprint: input.requestFingerprint } : {}),
      }),
    ])

    await seedDemoData(client, organizationId)
    await client.query("COMMIT")

    return {
      environmentId,
      kind: input.kind,
      expiresAt: expiresAt.toISOString(),
      organization: { id: organizationId, name: storeName, slug },
      tenantContext: {
        userId: adminUserId,
        email,
        organizationId,
        organizationName: storeName,
        organizationSlug: slug,
        role: "owner",
        sessionVersion: 1,
      },
      reused: false,
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function getDemoHealthCounts() {
  try {
    const result = await getPostgresPool().query<{
      active_public: string
      active_trial: string
      expired: string
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' AND expires_at > now() AND kind = 'public')::text AS active_public,
        COUNT(*) FILTER (WHERE status = 'active' AND expires_at > now() AND kind = 'trial')::text AS active_trial,
        COUNT(*) FILTER (WHERE status = 'expired' OR expires_at <= now())::text AS expired
      FROM sf_demo_environments
    `)
    const row = result.rows[0]
    return {
      activePublic: Number(row?.active_public || 0),
      activeTrials: Number(row?.active_trial || 0),
      expired: Number(row?.expired || 0),
    }
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01") return null
    throw error
  }
}
