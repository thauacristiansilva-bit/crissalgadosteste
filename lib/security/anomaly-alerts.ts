import {
  createHash,
  randomUUID,
} from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import { runWithRlsBypass } from "@/lib/rls-context"

export type SecurityAlertSeverity =
  | "warning"
  | "high"
  | "critical"

type SecurityAlertCandidate = {
  fingerprint: string
  alertType: string
  severity: SecurityAlertSeverity
  title: string
  description: string
  organizationId: string | null
  userId: string | null
  metadata: Record<string, unknown>
  cooldownHours: number
}

type DetectedAlert = {
  id: string
  created: boolean
  candidate: SecurityAlertCandidate
}

type AlertRow = {
  id: string
  organization_id: string | null
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: Date | string
}

export type SecurityAlertSummary = {
  id: string
  organizationId: string | null
  userId: string | null
  alertType: string
  severity: SecurityAlertSeverity
  title: string
  description: string
  notified: boolean
  createdAt: string
}

export type SecurityAnomalyScanResult = {
  ok: true
  scannedAt: string
  candidates: number
  newlyDetected: number
  emailsSent: number
  notificationsSkipped: number
  emailConfigured: boolean
}

function fingerprint(
  alertType: string,
  parts: Array<string | number | null | undefined>,
) {
  return createHash("sha256")
    .update(
      [
        "saborflow-security-anomaly-v1",
        alertType,
        ...parts.map((part) => String(part ?? "")),
      ].join("|"),
    )
    .digest("hex")
}

function normalizeSeverity(value: unknown): SecurityAlertSeverity {
  if (value === "critical") return "critical"
  if (value === "high") return "high"
  return "warning"
}

function safeText(value: unknown, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function collectRateLimitCandidates() {
  const result = await getPostgresPool().query<{
    key_hash: string
    failures: number
    reset_at: Date | string
  }>(
    `
      SELECT key_hash, failures, reset_at
      FROM sf_auth_rate_limits
      WHERE reset_at > now()
        AND failures >= 5
      ORDER BY failures DESC
      LIMIT 50
    `,
  )

  return result.rows.map<SecurityAlertCandidate>((row) => {
    const failures = Math.max(0, Number(row.failures) || 0)
    const severity: SecurityAlertSeverity =
      failures >= 20
        ? "critical"
        : failures >= 10
          ? "high"
          : "warning"

    const bucketRef = String(row.key_hash || "").slice(0, 12)

    return {
      fingerprint: fingerprint(
        "auth_rate_limit",
        [row.key_hash],
      ),
      alertType: "auth_rate_limit",
      severity,
      title: "Múltiplas falhas de autenticação",
      description:
        `Um agrupamento de autenticação acumulou ${failures} falhas dentro da janela ativa de proteção.`,
      organizationId: null,
      userId: null,
      metadata: {
        failures,
        bucketRef,
        resetAt: new Date(row.reset_at).toISOString(),
      },
      cooldownHours: 1,
    }
  })
}

async function collectSessionStormCandidates() {
  const result = await getPostgresPool().query<{
    user_id: string
    organization_id: string
    session_count: number
    distinct_ips: number
    distinct_user_agents: number
  }>(
    `
      SELECT
        user_id,
        organization_id,
        COUNT(*)::int AS session_count,
        COUNT(DISTINCT ip_hash)
          FILTER (WHERE ip_hash IS NOT NULL)::int AS distinct_ips,
        COUNT(DISTINCT user_agent_hash)
          FILTER (WHERE user_agent_hash IS NOT NULL)::int AS distinct_user_agents
      FROM sf_admin_sessions
      WHERE created_at >= now() - interval '15 minutes'
      GROUP BY user_id, organization_id
      HAVING COUNT(*) >= 5
         OR COUNT(DISTINCT ip_hash)
              FILTER (WHERE ip_hash IS NOT NULL) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
  )

  return result.rows.map<SecurityAlertCandidate>((row) => {
    const sessions = Math.max(0, Number(row.session_count) || 0)
    const distinctIps = Math.max(0, Number(row.distinct_ips) || 0)
    const distinctUserAgents =
      Math.max(0, Number(row.distinct_user_agents) || 0)

    const severity: SecurityAlertSeverity =
      sessions >= 10 || distinctIps >= 5
        ? "critical"
        : "high"

    return {
      fingerprint: fingerprint(
        "admin_session_storm",
        [row.user_id, row.organization_id],
      ),
      alertType: "admin_session_storm",
      severity,
      title: "Volume anormal de novas sessões",
      description:
        `Foram abertas ${sessions} sessões administrativas em 15 minutos, usando ${distinctIps} sinal(is) de rede e ${distinctUserAgents} navegador(es)/dispositivo(s) distintos.`,
      organizationId: row.organization_id,
      userId: row.user_id,
      metadata: {
        sessions,
        distinctIps,
        distinctUserAgents,
        windowMinutes: 15,
      },
      cooldownHours: 1,
    }
  })
}

async function collectSessionLimitCandidates() {
  const result = await getPostgresPool().query<{
    user_id: string
    organization_id: string
    revoked_count: number
  }>(
    `
      SELECT
        user_id,
        organization_id,
        COUNT(*)::int AS revoked_count
      FROM sf_admin_sessions
      WHERE revoked_at >= now() - interval '30 minutes'
        AND revoked_reason = 'active_session_limit'
      GROUP BY user_id, organization_id
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
  )

  return result.rows.map<SecurityAlertCandidate>((row) => ({
    fingerprint: fingerprint(
      "active_session_limit",
      [row.user_id, row.organization_id],
    ),
    alertType: "active_session_limit",
    severity: "critical",
    title: "Limite de sessões administrativas atingido",
    description:
      "O limite máximo de sessões ativas foi ultrapassado e sessões antigas precisaram ser revogadas automaticamente.",
    organizationId: row.organization_id,
    userId: row.user_id,
    metadata: {
      revokedSessions:
        Math.max(0, Number(row.revoked_count) || 0),
      windowMinutes: 30,
    },
    cooldownHours: 6,
  }))
}

async function collectSensitiveMutationCandidates() {
  const result = await getPostgresPool().query<{
    organization_id: string | null
    user_id: string
    event_count: number
    actions: string[]
  }>(
    `
      SELECT
        organization_id,
        user_id,
        COUNT(*)::int AS event_count,
        ARRAY_AGG(DISTINCT action ORDER BY action) AS actions
      FROM sf_audit_log
      WHERE created_at >= now() - interval '30 minutes'
        AND event_category = 'security'
        AND user_id IS NOT NULL
        AND action IN (
          'security.password.changed',
          'security.passkey.created',
          'security.passkey.removed',
          'security.2fa.enabled',
          'security.2fa.disabled',
          'security.2fa.recovery_codes_changed',
          'security.session.superadmin_authorization_changed'
        )
      GROUP BY organization_id, user_id
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
  )

  return result.rows.map<SecurityAlertCandidate>((row) => {
    const count = Math.max(0, Number(row.event_count) || 0)
    const actions = Array.isArray(row.actions)
      ? row.actions.map((item) => safeText(item, 100))
      : []

    return {
      fingerprint: fingerprint(
        "sensitive_security_mutations",
        [row.user_id, row.organization_id],
      ),
      alertType: "sensitive_security_mutations",
      severity: count >= 6 ? "critical" : "high",
      title: "Muitas alterações sensíveis na conta",
      description:
        `Foram registradas ${count} alterações sensíveis de segurança em apenas 30 minutos.`,
      organizationId: row.organization_id,
      userId: row.user_id,
      metadata: {
        count,
        actions,
        windowMinutes: 30,
      },
      cooldownHours: 2,
    }
  })
}

async function collectPasswordChangeBurstCandidates() {
  const result = await getPostgresPool().query<{
    organization_id: string | null
    user_id: string
    event_count: number
  }>(
    `
      SELECT
        organization_id,
        user_id,
        COUNT(*)::int AS event_count
      FROM sf_audit_log
      WHERE created_at >= now() - interval '1 hour'
        AND action = 'security.password.changed'
        AND user_id IS NOT NULL
      GROUP BY organization_id, user_id
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `,
  )

  return result.rows.map<SecurityAlertCandidate>((row) => {
    const count = Math.max(0, Number(row.event_count) || 0)

    return {
      fingerprint: fingerprint(
        "password_change_burst",
        [row.user_id, row.organization_id],
      ),
      alertType: "password_change_burst",
      severity: count >= 3 ? "critical" : "high",
      title: "Trocas repetidas de senha",
      description:
        `A senha administrativa foi alterada ${count} vezes dentro de uma hora.`,
      organizationId: row.organization_id,
      userId: row.user_id,
      metadata: {
        count,
        windowMinutes: 60,
      },
      cooldownHours: 6,
    }
  })
}

async function collectCandidates() {
  const groups = await Promise.all([
    collectRateLimitCandidates(),
    collectSessionStormCandidates(),
    collectSessionLimitCandidates(),
    collectSensitiveMutationCandidates(),
    collectPasswordChangeBurstCandidates(),
  ])

  const unique = new Map<string, SecurityAlertCandidate>()

  for (const candidate of groups.flat()) {
    const current = unique.get(candidate.fingerprint)

    if (
      !current ||
      candidate.severity === "critical" ||
      (
        candidate.severity === "high" &&
        current.severity === "warning"
      )
    ) {
      unique.set(candidate.fingerprint, candidate)
    }
  }

  return [...unique.values()]
}

async function ensureDetectedAlert(
  candidate: SecurityAlertCandidate,
): Promise<DetectedAlert> {
  const existing = await getPostgresPool().query<{
    id: string
  }>(
    `
      SELECT id::text
      FROM sf_audit_log
      WHERE action = 'security.alert.detected'
        AND metadata->>'fingerprint' = $1
        AND created_at >=
          now() - ($2::int * interval '1 hour')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [
      candidate.fingerprint,
      candidate.cooldownHours,
    ],
  )

  const current = existing.rows[0]?.id
  if (current) {
    return {
      id: current,
      created: false,
      candidate,
    }
  }

  const id = randomUUID()

  await getPostgresPool().query(
    `
      INSERT INTO sf_audit_log (
        id,
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata,
        event_category,
        outcome,
        source,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'security.alert.detected',
        'security_anomaly',
        $4,
        $5::jsonb,
        'security',
        'detected',
        'anomaly-detector',
        now()
      )
    `,
    [
      id,
      candidate.organizationId,
      candidate.userId,
      candidate.fingerprint,
      JSON.stringify({
        fingerprint: candidate.fingerprint,
        alertType: candidate.alertType,
        severity: candidate.severity,
        title: candidate.title,
        description: candidate.description,
        ...candidate.metadata,
      }),
    ],
  )

  return {
    id,
    created: true,
    candidate,
  }
}

async function alertWasNotified(alertId: string) {
  const result = await getPostgresPool().query<{
    notified: boolean
  }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM sf_audit_log
        WHERE action = 'security.alert.notified'
          AND entity_type = 'security_alert'
          AND entity_id = $1
      ) AS notified
    `,
    [alertId],
  )

  return Boolean(result.rows[0]?.notified)
}

async function notificationFailedRecently(alertId: string) {
  const result = await getPostgresPool().query<{
    failed_recently: boolean
  }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM sf_audit_log
        WHERE action = 'security.alert.notification_failed'
          AND entity_type = 'security_alert'
          AND entity_id = $1
          AND created_at >= now() - interval '15 minutes'
      ) AS failed_recently
    `,
    [alertId],
  )

  return Boolean(result.rows[0]?.failed_recently)
}

async function ownerAlertRecipients() {
  const configured =
    process.env.SECURITY_ALERT_EMAIL_TO?.trim() || ""

  const recipients = new Set(
    configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^\S+@\S+\.\S+$/.test(value)),
  )

  const result = await getPostgresPool().query<{
    email: string
  }>(
    `
      SELECT DISTINCT lower(u.email) AS email
      FROM sf_platform_admins pa
      INNER JOIN sf_users u
        ON u.id = pa.user_id
      WHERE pa.status = 'active'
        AND pa.role = 'owner'
        AND u.status = 'active'
        AND u.email IS NOT NULL
    `,
  ).catch(() => ({ rows: [] as Array<{ email: string }> }))

  for (const row of result.rows) {
    const email = String(row.email || "").trim().toLowerCase()
    if (/^\S+@\S+\.\S+$/.test(email)) {
      recipients.add(email)
    }
  }

  return [...recipients].slice(0, 10)
}

function emailSettingsConfigured() {
  return Boolean(
    process.env.AUTH_RESEND_API_KEY?.trim() &&
    process.env.AUTH_EMAIL_FROM?.trim(),
  )
}

async function sendAlertEmail(
  alert: DetectedAlert,
  recipients: string[],
) {
  const apiKey =
    process.env.AUTH_RESEND_API_KEY?.trim() || ""
  const from =
    process.env.AUTH_EMAIL_FROM?.trim() || ""

  if (!apiKey || !from || recipients.length === 0) {
    return false
  }

  const title =
    `[SaborFlow] Alerta ${alert.candidate.severity.toUpperCase()}: ${alert.candidate.title}`

  const plainText = [
    "SaborFlow - Alerta de segurança",
    "",
    `Severidade: ${alert.candidate.severity}`,
    `Tipo: ${alert.candidate.alertType}`,
    `Alerta: ${alert.candidate.title}`,
    alert.candidate.description,
    "",
    `ID do alerta: ${alert.id}`,
    `Detectado em: ${new Date().toISOString()}`,
    "",
    "Verifique o painel e a trilha de auditoria antes de tomar qualquer ação.",
  ].join("\n")

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171717">
      <h2 style="margin-bottom:8px">SaborFlow · Alerta de segurança</h2>
      <p><strong>Severidade:</strong> ${escapeHtml(alert.candidate.severity.toUpperCase())}</p>
      <p><strong>Tipo:</strong> ${escapeHtml(alert.candidate.alertType)}</p>
      <p><strong>${escapeHtml(alert.candidate.title)}</strong></p>
      <p>${escapeHtml(alert.candidate.description)}</p>
      <hr style="border:0;border-top:1px solid #ddd;margin:24px 0" />
      <p style="font-size:12px;color:#666">
        ID do alerta: ${escapeHtml(alert.id)}<br />
        Verifique o painel e a trilha de auditoria antes de tomar qualquer ação.
      </p>
    </div>
  `.trim()

  const idempotencyKey = createHash("sha256")
    .update(`saborflow-security-alert:${alert.id}`)
    .digest("hex")

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: title.slice(0, 180),
        text: plainText,
        html,
      }),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `Resend recusou o alerta (${response.status}): ${body.slice(0, 300)}`,
    )
  }

  return true
}

async function recordNotificationResult(
  alert: DetectedAlert,
  action:
    | "security.alert.notified"
    | "security.alert.notification_failed",
  metadata: Record<string, unknown>,
) {
  await getPostgresPool().query(
    `
      INSERT INTO sf_audit_log (
        id,
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata,
        event_category,
        outcome,
        source,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'security_alert',
        $5,
        $6::jsonb,
        'security',
        $7,
        'anomaly-detector',
        now()
      )
    `,
    [
      randomUUID(),
      alert.candidate.organizationId,
      alert.candidate.userId,
      action,
      alert.id,
      JSON.stringify(metadata),
      action === "security.alert.notified"
        ? "notified"
        : "failed",
    ],
  )
}

export async function runSecurityAnomalyScan():
  Promise<SecurityAnomalyScanResult> {
  return runWithRlsBypass(async () => {
    const candidates = await collectCandidates()
    const recipients = await ownerAlertRecipients()
    const configured =
      emailSettingsConfigured() &&
      recipients.length > 0

    let newlyDetected = 0
    let emailsSent = 0
    let notificationsSkipped = 0

    for (const candidate of candidates) {
      const alert =
        await ensureDetectedAlert(candidate)

      if (alert.created) {
        newlyDetected += 1
      }

      if (await alertWasNotified(alert.id)) {
        notificationsSkipped += 1
        continue
      }

      if (!configured) {
        notificationsSkipped += 1
        continue
      }

      if (await notificationFailedRecently(alert.id)) {
        notificationsSkipped += 1
        continue
      }

      try {
        const sent =
          await sendAlertEmail(
            alert,
            recipients,
          )

        if (sent) {
          emailsSent += 1
          await recordNotificationResult(
            alert,
            "security.alert.notified",
            {
              recipientCount:
                recipients.length,
            },
          )
        }
      } catch (error) {
        await recordNotificationResult(
          alert,
          "security.alert.notification_failed",
          {
            error:
              error instanceof Error
                ? safeText(error.message, 500)
                : "Falha desconhecida ao enviar alerta.",
          },
        ).catch(() => undefined)
      }
    }

    return {
      ok: true,
      scannedAt: new Date().toISOString(),
      candidates: candidates.length,
      newlyDetected,
      emailsSent,
      notificationsSkipped,
      emailConfigured: configured,
    }
  })
}

export async function listRecentSecurityAlerts(
  limit = 100,
): Promise<SecurityAlertSummary[]> {
  return runWithRlsBypass(async () => {
    const safeLimit =
      Math.max(1, Math.min(200, Math.floor(limit)))

    const result =
      await getPostgresPool().query<AlertRow>(
        `
          SELECT
            a.id::text,
            a.organization_id,
            a.user_id,
            a.metadata,
            a.created_at
          FROM sf_audit_log a
          WHERE a.action = 'security.alert.detected'
          ORDER BY a.created_at DESC
          LIMIT $1
        `,
        [safeLimit],
      )

    if (result.rows.length === 0) {
      return []
    }

    const ids = result.rows.map((row) => row.id)
    const notified =
      await getPostgresPool().query<{
        entity_id: string
      }>(
        `
          SELECT DISTINCT entity_id
          FROM sf_audit_log
          WHERE action = 'security.alert.notified'
            AND entity_type = 'security_alert'
            AND entity_id = ANY($1::text[])
        `,
        [ids],
      )

    const notifiedIds =
      new Set(
        notified.rows.map((row) => row.entity_id),
      )

    return result.rows.map((row) => {
      const metadata =
        row.metadata &&
        typeof row.metadata === "object"
          ? row.metadata
          : {}

      return {
        id: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        alertType:
          safeText(metadata.alertType, 100) ||
          "security_anomaly",
        severity:
          normalizeSeverity(metadata.severity),
        title:
          safeText(metadata.title, 240) ||
          "Alerta de segurança",
        description:
          safeText(metadata.description, 1_000),
        notified:
          notifiedIds.has(row.id),
        createdAt:
          new Date(row.created_at).toISOString(),
      }
    })
  })
}
