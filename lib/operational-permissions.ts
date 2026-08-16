import type { OrganizationRole } from "@/lib/tenant-context"

export const CUSTOM_PERMISSION_MARKER = "__saborflow_custom_permissions_v1__"

export const OPERATIONAL_PERMISSION_CATALOG = [
  { id: "dashboard.view", group: "Painel", label: "Ver visão geral" },
  { id: "pdv.use", group: "Caixa / PDV", label: "Usar o PDV" },
  { id: "cash.manage", group: "Caixa / PDV", label: "Abrir, fechar e operar caixa" },
  { id: "orders.view", group: "Pedidos", label: "Ver pedidos" },
  { id: "orders.status.update", group: "Pedidos", label: "Alterar status de pedidos" },
  { id: "orders.payment.update", group: "Pedidos", label: "Alterar status de pagamento" },
  { id: "kitchen.use", group: "Cozinha", label: "Usar painel da cozinha" },
  { id: "delivery.manage", group: "Entrega", label: "Gerenciar entregadores e entregas" },
  { id: "catalog.view", group: "Cardápio", label: "Ver cardápio e categorias" },
  { id: "catalog.manage", group: "Cardápio", label: "Alterar cardápio, categorias e composição" },
  { id: "customers.view", group: "Clientes", label: "Ver clientes" },
  { id: "customers.manage", group: "Clientes", label: "Cadastrar e alterar clientes" },
  { id: "finance.view", group: "Financeiro", label: "Ver vendas, caixa e DRE" },
  { id: "finance.manage", group: "Financeiro", label: "Lançar e alterar informações financeiras" },
  { id: "reports.view", group: "Inteligência", label: "Ver relatórios avançados" },
  { id: "marketing.view", group: "Marketing", label: "Ver avaliações e campanhas" },
  { id: "marketing.manage", group: "Marketing", label: "Gerenciar cupons e divulgação" },
  { id: "crm.manage", group: "CRM", label: "Usar CRM e fidelidade" },
  { id: "food_operations.manage", group: "Produção", label: "Gerenciar operação alimentar avançada" },
  { id: "integrations.manage", group: "Integrações", label: "Configurar integrações externas" },
  { id: "team.view", group: "Equipe", label: "Ver equipe" },
  { id: "team.manage", group: "Equipe", label: "Cadastrar e alterar colaboradores" },
  { id: "access.manage", group: "Equipe", label: "Gerenciar logins e permissões" },
  { id: "settings.view", group: "Empresa", label: "Ver configurações da empresa" },
  { id: "settings.manage", group: "Empresa", label: "Alterar configurações da empresa" },
  { id: "security.view", group: "Segurança", label: "Ver conta e segurança" },
  { id: "security.manage", group: "Segurança", label: "Gerenciar domínios, impressão e segurança" },
  { id: "billing.view", group: "Assinatura", label: "Ver plano e assinatura" },
] as const

export type OperationalPermission =
  (typeof OPERATIONAL_PERMISSION_CATALOG)[number]["id"]

const ALL_PERMISSIONS = OPERATIONAL_PERMISSION_CATALOG.map(
  (item) => item.id,
) as OperationalPermission[]

const managerDenied = new Set<OperationalPermission>([
  "access.manage",
  "security.manage",
  "billing.view",
])

export const ROLE_PERMISSION_PRESETS: Record<
  OrganizationRole,
  OperationalPermission[]
> = {
  owner: [...ALL_PERMISSIONS],
  admin: ALL_PERMISSIONS.filter((permission) => permission !== "billing.view"),
  manager: ALL_PERMISSIONS.filter(
    (permission) => !managerDenied.has(permission),
  ),
  cashier: [
    "dashboard.view",
    "pdv.use",
    "cash.manage",
    "orders.view",
    "orders.status.update",
    "orders.payment.update",
    "customers.view",
    "customers.manage",
    "security.view",
  ],
  kitchen: [
    "orders.view",
    "orders.status.update",
    "kitchen.use",
    "security.view",
  ],
  courier: [
    "orders.view",
    "orders.status.update",
    "security.view",
  ],
  member: [
    "dashboard.view",
    "security.view",
  ],
}

const validPermissionIds = new Set<string>(ALL_PERMISSIONS)

export function sanitizeOperationalPermissions(
  values: readonly string[] | null | undefined,
): OperationalPermission[] {
  if (!Array.isArray(values)) return []

  return [...new Set(
    values
      .map(String)
      .filter((value) => validPermissionIds.has(value)),
  )] as OperationalPermission[]
}

export function getRolePermissionPreset(
  role: OrganizationRole,
): OperationalPermission[] {
  return [...ROLE_PERMISSION_PRESETS[role]]
}

export function roleHasOperationalPermission(
  role: OrganizationRole,
  permission: OperationalPermission,
) {
  return ROLE_PERMISSION_PRESETS[role].includes(permission)
}

export function permissionListHas(
  permissions: readonly string[] | null | undefined,
  permission: OperationalPermission,
) {
  return Boolean(permissions?.includes(permission))
}

export function storedPermissionsAreCustom(
  stored: readonly string[] | null | undefined,
) {
  return Boolean(stored?.includes(CUSTOM_PERMISSION_MARKER))
}

export function getCustomPermissionsFromStorage(
  stored: readonly string[] | null | undefined,
) {
  if (!storedPermissionsAreCustom(stored)) return []
  return sanitizeOperationalPermissions(stored)
}

export function toCustomPermissionStorage(
  permissions: readonly string[],
) {
  return [
    CUSTOM_PERMISSION_MARKER,
    ...sanitizeOperationalPermissions(permissions),
  ]
}
