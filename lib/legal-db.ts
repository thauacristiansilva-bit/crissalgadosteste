import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  type LegalAcceptanceSource,
} from "@/lib/legal-documents"

type AcceptanceContext = {
  userId: string
  organizationId?: string | null
  source: LegalAcceptanceSource
  ipAddress?: string | null
  userAgent?: string | null
}

async function insertAuditAcceptance(
  client: PoolClient,
  input: AcceptanceContext & {
    action: string
    documentType: "terms" | "privacy"
    documentVersion: string
  },
) {
  await client.query(
    `
      INSERT INTO sf_audit_log (
        id, organization_id, user_id, action, entity_type, entity_id,
        metadata, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, 'legal_document', $5, $6::jsonb, $7, now())
    `,
    [
      randomUUID(),
      input.organizationId || null,
      input.userId,
      input.action,
      input.documentType,
      JSON.stringify({
        documentType: input.documentType,
        documentVersion: input.documentVersion,
        source: input.source,
        userAgent: input.userAgent || "",
      }),
      input.ipAddress || null,
    ],
  )
}

export async function recordCurrentLegalAcceptanceWithClient(
  client: PoolClient,
  input: AcceptanceContext,
) {
  // Cadastros comerciais aceitam os documentos antes da primeira organização
  // existir. Como sf_audit_log é protegida por FORCE RLS, permitimos bypass
  // somente dentro da transação já autenticada do backend e apenas para estes
  // dois INSERTs de auditoria sem organization_id.
  const needsBootstrapBypass = !input.organizationId

  if (needsBootstrapBypass) {
    await client.query(
      "SELECT set_config('app.rls_bypass', 'true', true)",
    )
  }

  try {
    await insertAuditAcceptance(client, {
      ...input,
      action: "legal.terms.accepted",
      documentType: "terms",
      documentVersion: TERMS_VERSION,
    })
    await insertAuditAcceptance(client, {
      ...input,
      action: "legal.privacy.acknowledged",
      documentType: "privacy",
      documentVersion: PRIVACY_VERSION,
    })
  } finally {
    if (needsBootstrapBypass) {
      await client.query(
        "SELECT set_config('app.rls_bypass', 'false', true)",
      ).catch(() => undefined)
    }
  }
}

export async function recordCurrentLegalAcceptance(input: AcceptanceContext) {
  if (!input.organizationId) {
    throw new Error("Aceite administrativo exige organizationId.")
  }

  return runWithTenantRlsScope(
    [input.organizationId],
    input.userId,
    async () => {
      const client = await getPostgresPool().connect()
      try {
        await client.query("BEGIN")
        await recordCurrentLegalAcceptanceWithClient(client, input)
        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    },
    "tenant-session",
  )
}

export async function hasCurrentLegalAcceptance(
  userId: string,
  organizationId: string,
) {
  return runWithTenantRlsScope(
    [organizationId],
    userId,
    async () => {
      const result = await getPostgresPool().query<{
        terms_ok: boolean
        privacy_ok: boolean
      }>(
        `
          SELECT
            EXISTS (
              SELECT 1 FROM sf_audit_log
              WHERE organization_id = $1
                AND user_id = $2
                AND action = 'legal.terms.accepted'
                AND metadata->>'documentVersion' = $3
            ) AS terms_ok,
            EXISTS (
              SELECT 1 FROM sf_audit_log
              WHERE organization_id = $1
                AND user_id = $2
                AND action = 'legal.privacy.acknowledged'
                AND metadata->>'documentVersion' = $4
            ) AS privacy_ok
        `,
        [organizationId, userId, TERMS_VERSION, PRIVACY_VERSION],
      )

      return Boolean(
        result.rows[0]?.terms_ok &&
        result.rows[0]?.privacy_ok,
      )
    },
    "tenant-session",
  )
}

export async function recordCustomerPrivacyAcknowledgement(input: {
  organizationId: string
  customerId: number
  source: "store-customer-register"
  ipAddress?: string | null
  userAgent?: string | null
}) {
  return runWithTenantRlsScope(
    [input.organizationId],
    null,
    () =>
      getPostgresPool().query(
        `
          INSERT INTO sf_audit_log (
            id, organization_id, user_id, action, entity_type, entity_id,
            metadata, ip_address, created_at
          ) VALUES ($1, $2, NULL, 'legal.customer_privacy.acknowledged',
            'customer_account', $3, $4::jsonb, $5, now())
        `,
        [
          randomUUID(),
          input.organizationId,
          String(input.customerId),
          JSON.stringify({
            documentType: "privacy",
            documentVersion: PRIVACY_VERSION,
            source: input.source,
            userAgent: input.userAgent || "",
          }),
          input.ipAddress || null,
        ],
      ),
    "customer-session",
  )
}
