import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import {
  resolveServerPublicOrganization,
} from "@/lib/public-tenant"
import {
  getTenantCustomerAccount,
  isTenantCustomersReady,
} from "@/lib/customer-db"
import type { CustomerAccount } from "@/lib/types"
import { enterTenantRlsContext, runWithTenantRlsScope } from "@/lib/rls-context"

export const CLIENT_SESSION_COOKIE = "saborflow_client_session"
// Mantido só para limpeza de cookies antigos.
export const LEGACY_CLIENT_SESSION_COOKIE = "cris_client_session"

function secret() {
  const configured =
    process.env.CLIENT_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim()

  if (!configured) {
    throw new Error(
      "CLIENT_SESSION_SECRET ou SESSION_SECRET é obrigatório na Fase 25.",
    )
  }

  return configured
}

function sign(value: string) {
  return createHmac("sha256", secret())
    .update(value)
    .digest("base64url")
}

function signaturesMatch(actual: string, expected: string) {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
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
      Math.floor(Date.now() / 1000) + maxAgeDays * 86_400,
  }

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
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
      payload.expiresAt < Math.floor(Date.now() / 1000)
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

export type CurrentCustomerContext = {
  organizationId: string
  account: CustomerAccount
  sessionMode: "tenant" | "legacy"
}

export async function getCurrentCustomerContext(): Promise<CurrentCustomerContext | null> {
  const cookieStore = await cookies()
  const publicOrganization = await resolveServerPublicOrganization()
  if (!publicOrganization) return null

  const organizationId = publicOrganization.id

  const context = await runWithTenantRlsScope(
    [organizationId],
    undefined,
    async () => {
      if (!(await isTenantCustomersReady(organizationId).catch(() => false))) {
        return null
      }

      const token = parseV2Token(
        cookieStore.get(CLIENT_SESSION_COOKIE)?.value,
      )

      if (!token || token.organizationId !== organizationId) {
        return null
      }

      const account = await getTenantCustomerAccount(
        organizationId,
        token.accountId,
      )

      if (!account) return null

      return {
        organizationId,
        account,
        sessionMode: "tenant" as const,
      }
    },
    "customer-session",
  )

  if (context) {
    // Mantém o tenant ativo para operações executadas pelo chamador depois
    // da validação da sessão (ex.: atualização de perfil e checkout).
    enterTenantRlsContext(
      organizationId,
      undefined,
      "customer-session",
    )
  }

  return context
}

export async function getCurrentCustomerAccount() {
  const context = await getCurrentCustomerContext()
  return context?.account ?? null
}
