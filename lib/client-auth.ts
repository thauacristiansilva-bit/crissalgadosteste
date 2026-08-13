import {
  createHmac,
  timingSafeEqual,
} from "node:crypto"
import { cookies } from "next/headers"
import {
  getCurrentDeploymentOrganizationId,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  resolveServerPublicOrganization,
} from "@/lib/public-tenant"
import {
  getTenantCustomerAccount,
  isTenantCustomersReady,
} from "@/lib/customer-db"
import {
  getCustomerAccount as getLegacyCustomerAccount,
} from "@/lib/db"
import type { CustomerAccount } from "@/lib/types"
import { enterTenantRlsContext } from "@/lib/rls-context"

export const CLIENT_SESSION_COOKIE = "saborflow_client_session"
export const LEGACY_CLIENT_SESSION_COOKIE = "cris_client_session"

function secret() {
  return (
    process.env.CLIENT_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "saborflow-client-dev-secret-change-me"
  )
}

function legacySecret() {
  return (
    process.env.CLIENT_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "cris-client-dev-secret-change-me"
  )
}

function sign(value: string) {
  return createHmac("sha256", secret())
    .update(value)
    .digest("base64url")
}

function signaturesMatch(actual: string, expected: string) {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  )
}

export function createClientToken(
  organizationId: string,
  accountId: number,
  maxAgeDays: number,
) {
  const payload = {
    v: 2,
    organizationId,
    accountId,
    expiresAt:
      Math.floor(Date.now() / 1000) +
      maxAgeDays * 86_400,
  }

  const encoded = Buffer.from(
    JSON.stringify(payload),
  ).toString("base64url")

  return `v2.${encoded}.${sign(encoded)}`
}

function parseV2Token(token?: string | null) {
  if (!token?.startsWith("v2.")) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [, encoded, signature] = parts
  if (!encoded || !signature) return null
  if (!signaturesMatch(signature, sign(encoded))) return null

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as {
      v?: number
      organizationId?: string
      accountId?: number
      expiresAt?: number
    }

    if (
      payload.v !== 2 ||
      !payload.organizationId ||
      !Number.isInteger(payload.accountId) ||
      !payload.expiresAt ||
      payload.expiresAt <
        Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    return {
      organizationId: payload.organizationId,
      accountId: Number(payload.accountId),
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

function parseLegacyToken(token?: string | null) {
  if (!token) return null

  const [idText, expiresText, signature] = token.split(".")
  const accountId = Number(idText)
  const expires = Number(expiresText)

  if (
    !Number.isInteger(accountId) ||
    !Number.isFinite(expires) ||
    expires < Math.floor(Date.now() / 1000) ||
    !signature
  ) {
    return null
  }

  const payload = `${accountId}.${expires}`
  const expected = createHmac("sha256", legacySecret())
    .update(payload)
    .digest("hex")

  if (!signaturesMatch(signature, expected)) return null

  return {
    accountId,
    expiresAt: expires,
  }
}

export type CurrentCustomerContext = {
  organizationId: string
  account: CustomerAccount
  sessionMode: "tenant" | "legacy"
}

export async function getCurrentCustomerContext():
  Promise<CurrentCustomerContext | null> {
  const cookieStore = await cookies()
  const publicOrganization =
    await resolveServerPublicOrganization()

  const currentOrganizationId =
    publicOrganization?.id ||
    (await getCurrentDeploymentOrganizationId())

  if (!currentOrganizationId) return null

  enterTenantRlsContext(
    currentOrganizationId,
    undefined,
    "customer-session",
  )

  const v2 = parseV2Token(
    cookieStore.get(CLIENT_SESSION_COOKIE)?.value,
  )

  if (
    v2 &&
    v2.organizationId === currentOrganizationId &&
    (await isTenantCustomersReady(currentOrganizationId))
  ) {
    const account = await getTenantCustomerAccount(
      currentOrganizationId,
      v2.accountId,
    )

    if (account) {
      return {
        organizationId: currentOrganizationId,
        account,
        sessionMode: "tenant",
      }
    }
  }

  // Sessões legadas não carregavam organization_id. Por segurança, elas
  // só são aceitas para a empresa original do deployment. Em outra empresa,
  // o cliente precisa autenticar novamente e recebe o cookie v2 tenant-aware.
  if (
    !(await isCurrentDeploymentOrganization(
      currentOrganizationId,
    ))
  ) {
    return null
  }

  // Compatibilidade: um cliente que já estava logado antes da Fase 6 não
  // perde a sessão na empresa original do deployment.
  const legacy = parseLegacyToken(
    cookieStore.get(LEGACY_CLIENT_SESSION_COOKIE)?.value ||
      cookieStore.get(CLIENT_SESSION_COOKIE)?.value,
  )

  if (!legacy) return null

  if (await isTenantCustomersReady(currentOrganizationId)) {
    const tenantAccount = await getTenantCustomerAccount(
      currentOrganizationId,
      legacy.accountId,
    )

    if (tenantAccount) {
      return {
        organizationId: currentOrganizationId,
        account: tenantAccount,
        sessionMode: "legacy",
      }
    }
  }

  const account = await getLegacyCustomerAccount(
    legacy.accountId,
  )

  if (!account) return null

  return {
    organizationId: currentOrganizationId,
    account,
    sessionMode: "legacy",
  }
}

export async function getCurrentCustomerAccount() {
  const context = await getCurrentCustomerContext()
  return context?.account ?? null
}
