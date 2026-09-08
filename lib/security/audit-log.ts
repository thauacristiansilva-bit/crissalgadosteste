import { getPostgresPool } from "@/lib/postgres"

export type AuditEvent = {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown>
  category: string
  outcome: string
  source: string
  sessionId: string | null
  actorRole: string | null
  ipHash: string | null
  userAgentHash: string | null
  createdAt: string
}

type AuditRow = {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  event_category: string
  outcome: string
  source: string
  session_id: string | null
  actor_role: string | null
  ip_hash: string | null
  user_agent_hash: string | null
  created_at: Date
}

function safeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]"
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => safeMetadata(item, depth + 1))
  }

  if (typeof value !== "object") {
    if (typeof value === "string") return value.slice(0, 2_000)
    return value
  }

  const blocked = /password|secret|token|credential|recovery|cookie|authorization|document|cpf|cnpj/i
  const output: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    output[key] = blocked.test(key) ? "[redacted]" : safeMetadata(entry, depth + 1)
  }

  return output
}

export async function listTenantAuditEvents(input: {
  organizationId: string
  limit: number
  actionPrefix?: string | null
  category?: string | null
}) {
  const actionPattern = input.actionPrefix ? `${input.actionPrefix}%` : null

  const result = await getPostgresPool().query<AuditRow>(
    `
      SELECT
        id::text,
        action,
        entity_type,
        entity_id,
        metadata,
        event_category,
        outcome,
        source,
        session_id,
        actor_role,
        ip_hash,
        user_agent_hash,
        created_at
      FROM sf_audit_log
      WHERE organization_id = $1
        AND ($2::text IS NULL OR action LIKE $2)
        AND ($3::text IS NULL OR event_category = $3)
      ORDER BY created_at DESC
      LIMIT $4
    `,
    [input.organizationId, actionPattern, input.category || null, input.limit],
  )

  return result.rows.map<AuditEvent>((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: safeMetadata(row.metadata || {}) as Record<string, unknown>,
    category: row.event_category,
    outcome: row.outcome,
    source: row.source,
    sessionId: row.session_id,
    actorRole: row.actor_role,
    ipHash: row.ip_hash,
    userAgentHash: row.user_agent_hash,
    createdAt: row.created_at.toISOString(),
  }))
}
