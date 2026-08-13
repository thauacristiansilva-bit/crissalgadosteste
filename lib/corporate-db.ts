import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import type { TenantAdminSession } from "@/lib/tenant-access"

export type CorporateGroupRole = "owner" | "admin" | "analyst"
export type CorporateUnitType = "headquarters" | "branch"

export type CorporateOrganization = {
  id: string
  name: string
  slug: string
  status: string
  billingAccountId: string
  hasTenantAccess: boolean
  tenantRole: string | null
  inGroup: boolean
  unitType: CorporateUnitType | null
  unitCode: string
  costCenter: string
  orders30d: number
  revenue30d: number
  openOrders: number
  financialIncome30d: number
  financialExpense30d: number
}

export type CorporateMember = {
  id: string
  userId: string
  name: string
  email: string
  role: CorporateGroupRole
  status: "active" | "disabled"
  createdAt: string
}

export type CorporateOverview = {
  schemaReady: boolean
  account: {
    id: string
    ownerUserId: string
    ownerEmail: string | null
    isBillingOwner: boolean
  } | null
  currentOrganization: {
    id: string
    name: string
    role: string
  }
  group: {
    id: string
    name: string
    status: "active" | "archived"
    role: CorporateGroupRole | null
    createdAt: string
  } | null
  permissions: {
    canCreateGroup: boolean
    canManageGroup: boolean
    canManageUnits: boolean
    canManageMembers: boolean
  }
  metrics: {
    units: number
    branches: number
    orders30d: number
    revenue30d: number
    openOrders: number
    financialIncome30d: number
    financialExpense30d: number
  }
  organizations: CorporateOrganization[]
  members: CorporateMember[]
  boundaries: {
    sameBillingAccountOnly: true
    consolidatedReadDoesNotGrantTenantWrite: true
    operationalAccessRequiresTenantMembership: true
    exactlyOneHeadquartersPerActiveGroup: true
  }
}

type AccountRow = {
  billing_account_id: string
  owner_user_id: string
  billing_email: string | null
}

type GroupRow = {
  id: string
  name: string
  status: "active" | "archived"
  created_at: Date | string
  member_role: CorporateGroupRole | null
}

type OrganizationRow = {
  id: string
  trade_name: string
  slug: string
  status: string
  billing_account_id: string
  tenant_role: string | null
  unit_type: CorporateUnitType | null
  unit_code: string | null
  cost_center: string | null
  orders_30d: string
  revenue_30d: string
  open_orders: string
  financial_income_30d: string
  financial_expense_30d: string
}

type MemberRow = {
  id: string
  user_id: string
  name: string
  email: string
  role: CorporateGroupRole
  status: "active" | "disabled"
  created_at: Date | string
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function number(value: string | number | null | undefined) {
  return Number(value || 0)
}

function canManage(role: CorporateGroupRole | null) {
  return role === "owner" || role === "admin"
}

function cleanText(value: string | null | undefined, maxLength: number) {
  return (value || "").trim().slice(0, maxLength)
}

async function schemaReady() {
  const result = await getPostgresPool().query<{
    groups: string | null
    units: string | null
    members: string | null
    audit: string | null
  }>(`
    SELECT
      to_regclass('public.sf_corporate_groups')::text AS groups,
      to_regclass('public.sf_corporate_group_organizations')::text AS units,
      to_regclass('public.sf_corporate_group_members')::text AS members,
      to_regclass('public.sf_corporate_group_audit')::text AS audit
  `)
  const row = result.rows[0]
  return Boolean(row?.groups && row.units && row.members && row.audit)
}

async function getAccountForOrganization(organizationId: string) {
  const result = await getPostgresPool().query<AccountRow>(
    `
      SELECT o.billing_account_id, ba.owner_user_id, ba.billing_email
      FROM sf_organizations o
      INNER JOIN sf_billing_accounts ba ON ba.id = o.billing_account_id
      WHERE o.id = $1
      LIMIT 1
    `,
    [organizationId],
  )
  return result.rows[0] || null
}

async function getGroupForAccount(accountId: string, userId: string) {
  const result = await getPostgresPool().query<GroupRow>(
    `
      SELECT
        g.id,
        g.name,
        g.status,
        g.created_at,
        gm.role AS member_role
      FROM sf_corporate_groups g
      LEFT JOIN sf_corporate_group_members gm
        ON gm.group_id = g.id
       AND gm.user_id = $2
       AND gm.status = 'active'
      WHERE g.billing_account_id = $1
        AND g.status = 'active'
      LIMIT 1
    `,
    [accountId, userId],
  )
  return result.rows[0] || null
}

async function recordAudit(
  client: PoolClient,
  groupId: string,
  actorUserId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: Record<string, unknown>,
  ipAddress: string | null,
) {
  await client.query(
    `
      INSERT INTO sf_corporate_group_audit (
        id, group_id, actor_user_id, action, target_type, target_id, metadata, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
    `,
    [
      randomUUID(),
      groupId,
      actorUserId,
      action,
      targetType,
      targetId,
      JSON.stringify(metadata),
      ipAddress,
    ],
  )
}

async function assertGroupManager(
  client: PoolClient,
  session: TenantAdminSession,
  groupId: string,
) {
  const result = await client.query<{
    billing_account_id: string
    owner_user_id: string
    member_role: CorporateGroupRole | null
  }>(
    `
      SELECT
        g.billing_account_id,
        ba.owner_user_id,
        gm.role AS member_role
      FROM sf_corporate_groups g
      INNER JOIN sf_billing_accounts ba ON ba.id = g.billing_account_id
      INNER JOIN sf_organizations current_organization
        ON current_organization.id = $3
       AND current_organization.billing_account_id = g.billing_account_id
      LEFT JOIN sf_corporate_group_members gm
        ON gm.group_id = g.id
       AND gm.user_id = $2
       AND gm.status = 'active'
      WHERE g.id = $1
        AND g.status = 'active'
      LIMIT 1
    `,
    [groupId, session.userId, session.organizationId],
  )

  const row = result.rows[0]
  if (!row) throw new Error("Grupo empresarial não encontrado.")

  const role: CorporateGroupRole | null =
    row.member_role || (row.owner_user_id === session.userId ? "owner" : null)

  if (!canManage(role)) {
    throw new Error("Seu perfil não pode administrar este grupo empresarial.")
  }

  return { ...row, role }
}

export async function getCorporateOverview(
  session: TenantAdminSession,
): Promise<CorporateOverview> {
  if (!(await schemaReady())) {
    return {
      schemaReady: false,
      account: null,
      currentOrganization: {
        id: session.organizationId,
        name: session.organizationName,
        role: session.role,
      },
      group: null,
      permissions: {
        canCreateGroup: false,
        canManageGroup: false,
        canManageUnits: false,
        canManageMembers: false,
      },
      metrics: {
        units: 0,
        branches: 0,
        orders30d: 0,
        revenue30d: 0,
        openOrders: 0,
        financialIncome30d: 0,
        financialExpense30d: 0,
      },
      organizations: [],
      members: [],
      boundaries: {
        sameBillingAccountOnly: true,
        consolidatedReadDoesNotGrantTenantWrite: true,
        operationalAccessRequiresTenantMembership: true,
        exactlyOneHeadquartersPerActiveGroup: true,
      },
    }
  }

  const account = await getAccountForOrganization(session.organizationId)
  if (!account) {
    return {
      schemaReady: true,
      account: null,
      currentOrganization: {
        id: session.organizationId,
        name: session.organizationName,
        role: session.role,
      },
      group: null,
      permissions: {
        canCreateGroup: false,
        canManageGroup: false,
        canManageUnits: false,
        canManageMembers: false,
      },
      metrics: {
        units: 0,
        branches: 0,
        orders30d: 0,
        revenue30d: 0,
        openOrders: 0,
        financialIncome30d: 0,
        financialExpense30d: 0,
      },
      organizations: [],
      members: [],
      boundaries: {
        sameBillingAccountOnly: true,
        consolidatedReadDoesNotGrantTenantWrite: true,
        operationalAccessRequiresTenantMembership: true,
        exactlyOneHeadquartersPerActiveGroup: true,
      },
    }
  }

  const group = await getGroupForAccount(account.billing_account_id, session.userId)
  const isBillingOwner = account.owner_user_id === session.userId
  const effectiveRole: CorporateGroupRole | null =
    group?.member_role || (group && isBillingOwner ? "owner" : null)
  const canSeeAccountScope = isBillingOwner || Boolean(effectiveRole)

  const organizationsResult = await getPostgresPool().query<OrganizationRow>(
    `
      SELECT
        o.id,
        o.trade_name,
        o.slug,
        o.status,
        o.billing_account_id,
        member.role AS tenant_role,
        unit.unit_type,
        COALESCE(unit.unit_code, '') AS unit_code,
        COALESCE(unit.cost_center, '') AS cost_center,
        COALESCE(order_metrics.orders_30d, 0)::text AS orders_30d,
        COALESCE(order_metrics.revenue_30d, 0)::text AS revenue_30d,
        COALESCE(order_metrics.open_orders, 0)::text AS open_orders,
        COALESCE(financial_metrics.income_30d, 0)::text AS financial_income_30d,
        COALESCE(financial_metrics.expense_30d, 0)::text AS financial_expense_30d
      FROM sf_organizations o
      LEFT JOIN LATERAL (
        SELECT m.role
        FROM sf_memberships m
        WHERE m.organization_id = o.id
          AND m.user_id = $2
          AND m.status = 'active'
        LIMIT 1
      ) member ON true
      LEFT JOIN sf_corporate_group_organizations unit
        ON unit.organization_id = o.id
       AND unit.group_id = $3
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE ord.created_at >= now() - interval '30 days'
              AND ord.status <> 'cancelled'
          )::bigint AS orders_30d,
          COALESCE(SUM(ord.total) FILTER (
            WHERE ord.created_at >= now() - interval '30 days'
              AND ord.status <> 'cancelled'
          ), 0) AS revenue_30d,
          COUNT(*) FILTER (
            WHERE ord.status IN ('pending', 'accepted', 'preparing', 'ready', 'in-route')
          )::bigint AS open_orders
        FROM sf_orders ord
        WHERE ord.organization_id = o.id
      ) order_metrics ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(fe.amount) FILTER (
            WHERE fe.type = 'income'
              AND fe.created_at >= now() - interval '30 days'
          ), 0) AS income_30d,
          COALESCE(SUM(fe.amount) FILTER (
            WHERE fe.type = 'expense'
              AND fe.created_at >= now() - interval '30 days'
          ), 0) AS expense_30d
        FROM sf_financial_entries fe
        WHERE fe.organization_id = o.id
      ) financial_metrics ON true
      WHERE o.billing_account_id = $1
        AND o.status <> 'cancelled'
        AND ($4::boolean = true OR o.id = $5::uuid)
      ORDER BY
        CASE unit.unit_type WHEN 'headquarters' THEN 0 WHEN 'branch' THEN 1 ELSE 2 END,
        unit.display_order ASC NULLS LAST,
        o.trade_name ASC
    `,
    [
      account.billing_account_id,
      session.userId,
      group?.id || null,
      canSeeAccountScope,
      session.organizationId,
    ],
  )

  const organizations: CorporateOrganization[] = organizationsResult.rows.map((row) => ({
    id: row.id,
    name: row.trade_name,
    slug: row.slug,
    status: row.status,
    billingAccountId: row.billing_account_id,
    hasTenantAccess: Boolean(row.tenant_role),
    tenantRole: row.tenant_role,
    inGroup: Boolean(row.unit_type),
    unitType: row.unit_type,
    unitCode: row.unit_code || "",
    costCenter: row.cost_center || "",
    orders30d: number(row.orders_30d),
    revenue30d: number(row.revenue_30d),
    openOrders: number(row.open_orders),
    financialIncome30d: number(row.financial_income_30d),
    financialExpense30d: number(row.financial_expense_30d),
  }))

  let members: CorporateMember[] = []
  if (group && effectiveRole) {
    const membersResult = await getPostgresPool().query<MemberRow>(
      `
        SELECT gm.id, gm.user_id, u.name, u.email, gm.role, gm.status, gm.created_at
        FROM sf_corporate_group_members gm
        INNER JOIN sf_users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
        ORDER BY
          CASE gm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
          u.name ASC,
          u.email ASC
      `,
      [group.id],
    )
    members = membersResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: iso(row.created_at),
    }))
  }

  const included = canSeeAccountScope
    ? organizations.filter((organization) => organization.inGroup)
    : []
  const manage = canManage(effectiveRole)

  return {
    schemaReady: true,
    account: canSeeAccountScope
      ? {
          id: account.billing_account_id,
          ownerUserId: account.owner_user_id,
          ownerEmail: account.billing_email,
          isBillingOwner,
        }
      : null,
    currentOrganization: {
      id: session.organizationId,
      name: session.organizationName,
      role: session.role,
    },
    group: group && canSeeAccountScope
      ? {
          id: group.id,
          name: group.name,
          status: group.status,
          role: effectiveRole,
          createdAt: iso(group.created_at),
        }
      : null,
    permissions: {
      canCreateGroup: !group && isBillingOwner && session.role === "owner",
      canManageGroup: manage,
      canManageUnits: manage,
      canManageMembers: manage,
    },
    metrics: {
      units: included.length,
      branches: included.filter((organization) => organization.unitType === "branch").length,
      orders30d: included.reduce((sum, organization) => sum + organization.orders30d, 0),
      revenue30d: included.reduce((sum, organization) => sum + organization.revenue30d, 0),
      openOrders: included.reduce((sum, organization) => sum + organization.openOrders, 0),
      financialIncome30d: included.reduce(
        (sum, organization) => sum + organization.financialIncome30d,
        0,
      ),
      financialExpense30d: included.reduce(
        (sum, organization) => sum + organization.financialExpense30d,
        0,
      ),
    },
    organizations,
    members,
    boundaries: {
      sameBillingAccountOnly: true,
      consolidatedReadDoesNotGrantTenantWrite: true,
      operationalAccessRequiresTenantMembership: true,
      exactlyOneHeadquartersPerActiveGroup: true,
    },
  }
}

export async function createCorporateGroup(
  session: TenantAdminSession,
  input: {
    name: string
    headquartersOrganizationId: string
    organizationIds: string[]
  },
  ipAddress: string | null,
) {
  const name = cleanText(input.name, 120)
  if (name.length < 2) throw new Error("Informe um nome válido para o grupo empresarial.")

  const account = await getAccountForOrganization(session.organizationId)
  if (!account) throw new Error("A organização atual não possui conta comercial vinculada.")
  if (account.owner_user_id !== session.userId || session.role !== "owner") {
    throw new Error("Somente o proprietário da conta comercial pode criar o grupo empresarial.")
  }

  const ids = Array.from(
    new Set(input.organizationIds.map((value) => value.trim()).filter(Boolean)),
  )
  const headquartersId = input.headquartersOrganizationId.trim()
  if (!headquartersId || !ids.includes(headquartersId)) {
    throw new Error("Selecione uma matriz entre as organizações do grupo.")
  }
  if (!ids.length) throw new Error("Selecione pelo menos uma organização.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")

    const existing = await client.query(
      `SELECT id FROM sf_corporate_groups WHERE billing_account_id = $1 LIMIT 1`,
      [account.billing_account_id],
    )
    if (existing.rowCount) throw new Error("Esta conta comercial já possui grupo empresarial.")

    const eligible = await client.query<{ id: string }>(
      `
        SELECT id
        FROM sf_organizations
        WHERE billing_account_id = $1
          AND status <> 'cancelled'
          AND id = ANY($2::uuid[])
      `,
      [account.billing_account_id, ids],
    )
    if (eligible.rowCount !== ids.length) {
      throw new Error("Uma ou mais organizações não pertencem à mesma conta comercial.")
    }

    const groupId = randomUUID()
    await client.query(
      `
        INSERT INTO sf_corporate_groups (
          id, billing_account_id, name, created_by_user_id, metadata
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        groupId,
        account.billing_account_id,
        name,
        session.userId,
        JSON.stringify({ source: "phase-19", createdFromOrganizationId: session.organizationId }),
      ],
    )

    for (let index = 0; index < ids.length; index += 1) {
      const organizationId = ids[index]
      await client.query(
        `
          INSERT INTO sf_corporate_group_organizations (
            group_id, organization_id, unit_type, display_order
          ) VALUES ($1, $2, $3, $4)
        `,
        [groupId, organizationId, organizationId === headquartersId ? "headquarters" : "branch", index],
      )
    }

    await client.query(
      `
        INSERT INTO sf_corporate_group_members (
          id, group_id, user_id, role, status, created_by_user_id
        ) VALUES ($1, $2, $3, 'owner', 'active', $3)
      `,
      [randomUUID(), groupId, session.userId],
    )

    await recordAudit(
      client,
      groupId,
      session.userId,
      "group.created",
      "corporate_group",
      groupId,
      { name, headquartersOrganizationId: headquartersId, organizationIds: ids },
      ipAddress,
    )

    await client.query("COMMIT")
    return groupId
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function renameCorporateGroup(
  session: TenantAdminSession,
  groupId: string,
  nameValue: string,
  ipAddress: string | null,
) {
  const name = cleanText(nameValue, 120)
  if (name.length < 2) throw new Error("Informe um nome válido para o grupo.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await assertGroupManager(client, session, groupId)
    await client.query(
      `UPDATE sf_corporate_groups SET name = $2, updated_at = now() WHERE id = $1`,
      [groupId, name],
    )
    await recordAudit(client, groupId, session.userId, "group.renamed", "corporate_group", groupId, { name }, ipAddress)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function addCorporateUnit(
  session: TenantAdminSession,
  groupId: string,
  input: {
    organizationId: string
    unitCode?: string
    costCenter?: string
  },
  ipAddress: string | null,
) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const access = await assertGroupManager(client, session, groupId)
    const organizationId = input.organizationId.trim()

    const organization = await client.query<{ id: string }>(
      `
        SELECT id
        FROM sf_organizations
        WHERE id = $1
          AND billing_account_id = $2
          AND status <> 'cancelled'
        LIMIT 1
      `,
      [organizationId, access.billing_account_id],
    )
    if (!organization.rows[0]) {
      throw new Error("A organização não pertence à mesma conta comercial do grupo.")
    }

    await client.query(
      `
        INSERT INTO sf_corporate_group_organizations (
          group_id, organization_id, unit_type, unit_code, cost_center,
          display_order, updated_at
        )
        VALUES (
          $1, $2, 'branch', $3, $4,
          COALESCE((SELECT MAX(display_order) + 1 FROM sf_corporate_group_organizations WHERE group_id = $1), 1),
          now()
        )
        ON CONFLICT (group_id, organization_id)
        DO UPDATE SET
          unit_code = EXCLUDED.unit_code,
          cost_center = EXCLUDED.cost_center,
          updated_at = now()
      `,
      [
        groupId,
        organizationId,
        cleanText(input.unitCode, 40),
        cleanText(input.costCenter, 80),
      ],
    )

    await recordAudit(client, groupId, session.userId, "unit.added", "organization", organizationId, {
      unitCode: cleanText(input.unitCode, 40),
      costCenter: cleanText(input.costCenter, 80),
    }, ipAddress)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function setCorporateHeadquarters(
  session: TenantAdminSession,
  groupId: string,
  organizationId: string,
  ipAddress: string | null,
) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await assertGroupManager(client, session, groupId)
    const target = await client.query(
      `SELECT organization_id FROM sf_corporate_group_organizations WHERE group_id = $1 AND organization_id = $2 LIMIT 1`,
      [groupId, organizationId],
    )
    if (!target.rowCount) throw new Error("A organização não faz parte deste grupo.")

    await client.query(
      `UPDATE sf_corporate_group_organizations SET unit_type = 'branch', updated_at = now() WHERE group_id = $1 AND unit_type = 'headquarters'`,
      [groupId],
    )
    await client.query(
      `UPDATE sf_corporate_group_organizations SET unit_type = 'headquarters', updated_at = now() WHERE group_id = $1 AND organization_id = $2`,
      [groupId, organizationId],
    )
    await recordAudit(client, groupId, session.userId, "unit.headquarters_changed", "organization", organizationId, {}, ipAddress)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function removeCorporateUnit(
  session: TenantAdminSession,
  groupId: string,
  organizationId: string,
  ipAddress: string | null,
) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await assertGroupManager(client, session, groupId)
    const target = await client.query<{ unit_type: CorporateUnitType }>(
      `SELECT unit_type FROM sf_corporate_group_organizations WHERE group_id = $1 AND organization_id = $2 LIMIT 1`,
      [groupId, organizationId],
    )
    if (!target.rows[0]) throw new Error("A organização não faz parte deste grupo.")
    if (target.rows[0].unit_type === "headquarters") {
      throw new Error("Defina outra matriz antes de remover a matriz atual.")
    }
    await client.query(
      `DELETE FROM sf_corporate_group_organizations WHERE group_id = $1 AND organization_id = $2`,
      [groupId, organizationId],
    )
    await recordAudit(client, groupId, session.userId, "unit.removed", "organization", organizationId, {}, ipAddress)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function addCorporateMember(
  session: TenantAdminSession,
  groupId: string,
  input: { email: string; role: CorporateGroupRole },
  ipAddress: string | null,
) {
  const email = cleanText(input.email, 320).toLowerCase()
  if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido.")
  if (!["owner", "admin", "analyst"].includes(input.role)) throw new Error("Papel corporativo inválido.")

  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const access = await assertGroupManager(client, session, groupId)
    if (input.role === "owner" && access.role !== "owner") {
      throw new Error("Somente um proprietário corporativo pode conceder o papel owner.")
    }

    const user = await client.query<{ id: string }>(
      `
        SELECT u.id
        FROM sf_users u
        WHERE lower(u.email) = lower($1)
          AND u.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM sf_memberships m
            INNER JOIN sf_organizations o ON o.id = m.organization_id
            INNER JOIN sf_corporate_groups g ON g.id = $2
            WHERE m.user_id = u.id
              AND m.status = 'active'
              AND o.billing_account_id = g.billing_account_id
          )
        LIMIT 1
      `,
      [email, groupId],
    )
    if (!user.rows[0]) {
      throw new Error("Usuário ativo com acesso a pelo menos uma organização desta conta não encontrado.")
    }

    await client.query(
      `
        INSERT INTO sf_corporate_group_members (
          id, group_id, user_id, role, status, created_by_user_id
        ) VALUES ($1, $2, $3, $4, 'active', $5)
        ON CONFLICT (group_id, user_id)
        DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
      `,
      [randomUUID(), groupId, user.rows[0].id, input.role, session.userId],
    )

    await recordAudit(client, groupId, session.userId, "member.upserted", "user", user.rows[0].id, { email, role: input.role }, ipAddress)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function setCorporateMemberStatus(
  session: TenantAdminSession,
  groupId: string,
  memberId: string,
  status: "active" | "disabled",
  ipAddress: string | null,
) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const access = await assertGroupManager(client, session, groupId)
    const target = await client.query<{
      user_id: string
      role: CorporateGroupRole
      status: "active" | "disabled"
    }>(
      `SELECT user_id, role, status FROM sf_corporate_group_members WHERE id = $1 AND group_id = $2 LIMIT 1`,
      [memberId, groupId],
    )
    const row = target.rows[0]
    if (!row) throw new Error("Membro corporativo não encontrado.")

    if (row.role === "owner" && access.role !== "owner") {
      throw new Error("Somente um proprietário corporativo pode alterar outro owner.")
    }

    if (status === "disabled" && row.role === "owner") {
      const owners = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM sf_corporate_group_members WHERE group_id = $1 AND role = 'owner' AND status = 'active' AND id <> $2`,
        [groupId, memberId],
      )
      if (Number(owners.rows[0]?.count || 0) < 1) {
        throw new Error("O grupo precisa manter pelo menos um proprietário ativo.")
      }
    }

    await client.query(
      `UPDATE sf_corporate_group_members SET status = $3, updated_at = now() WHERE id = $1 AND group_id = $2`,
      [memberId, groupId, status],
    )
    await recordAudit(client, groupId, session.userId, `member.${status}`, "user", row.user_id, { memberId, role: row.role }, ipAddress)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function corporateSchemaHealth(session: TenantAdminSession) {
  const ready = await schemaReady()
  if (!ready) {
    return {
      schemaReady: false,
      groupCount: 0,
      activeGroupMembers: 0,
      groupUnits: 0,
      currentAccountLinked: false,
      currentGroup: null,
    }
  }

  const account = await getAccountForOrganization(session.organizationId)
  if (!account) {
    return {
      schemaReady: true,
      groupCount: 0,
      activeGroupMembers: 0,
      groupUnits: 0,
      currentAccountLinked: false,
      currentGroup: null,
    }
  }

  const currentGroup = await getGroupForAccount(
    account.billing_account_id,
    session.userId,
  )
  const effectiveRole: CorporateGroupRole | null =
    currentGroup?.member_role ||
    (currentGroup && account.owner_user_id === session.userId ? "owner" : null)
  const accessibleGroup = currentGroup && effectiveRole ? currentGroup : null

  const [members, units] = accessibleGroup
    ? await Promise.all([
        getPostgresPool().query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM sf_corporate_group_members WHERE group_id = $1 AND status = 'active'`,
          [accessibleGroup.id],
        ),
        getPostgresPool().query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM sf_corporate_group_organizations WHERE group_id = $1`,
          [accessibleGroup.id],
        ),
      ])
    : [null, null]

  return {
    schemaReady: true,
    groupCount: accessibleGroup ? 1 : 0,
    activeGroupMembers: members ? number(members.rows[0]?.count) : 0,
    groupUnits: units ? number(units.rows[0]?.count) : 0,
    currentAccountLinked: true,
    currentGroup: accessibleGroup
      ? { id: accessibleGroup.id, name: accessibleGroup.name, role: effectiveRole }
      : null,
  }
}
