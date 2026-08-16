import type { AdminSession } from "@/lib/auth"
import { getAdminSession } from "@/lib/auth"
import { demoOrganizationIsUsable, touchDemoEnvironment } from "@/lib/demo-policy"
import {
  getOrganizationContextForUser,
  type OrganizationRole,
} from "@/lib/tenant-context"
import { enterTenantRlsContext } from "@/lib/rls-context"

export type TenantAdminSession = Extract<
  AdminSession,
  { mode: "tenant" }
>

export async function getVerifiedTenantSession():
  Promise<TenantAdminSession | null> {
  const session = await getAdminSession()

  if (
    !session ||
    session.mode !== "tenant"
  ) {
    return null
  }

  if (!(await demoOrganizationIsUsable(session.organizationId))) {
    return null
  }

  const current =
    await getOrganizationContextForUser(
      session.userId,
      session.organizationId,
    )

  if (!current) return null

  if (
    current.sessionVersion !==
    session.sessionVersion
  ) {
    return null
  }

  await touchDemoEnvironment(session.organizationId)

  // Reafirma o escopo no fim da verificação. Chamadas intermediárias usam
  // AsyncLocalStorage.run() e podem restaurar o contexto anterior ao retornar.
  // As rotas administrativas que chamam este helper devem sair daqui com o
  // tenant efetivo novamente ativo para todas as consultas PostgreSQL seguintes.
  enterTenantRlsContext(
    session.organizationId,
    session.userId,
    "tenant-session",
  )

  return {
    mode: "tenant",
    ...current,
    expiresAt: session.expiresAt,
  }
}

export function canManageCatalog(
  role: OrganizationRole,
) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager"
  )
}
