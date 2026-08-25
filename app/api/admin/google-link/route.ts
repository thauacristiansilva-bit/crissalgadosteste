import { NextResponse } from "next/server"
import { verifyGoogleCredential, googleSignInConfigured } from "@/lib/auth-providers/google"
import { getPostgresPool } from "@/lib/postgres"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const result = await getPostgresPool().query<{ google_subject: string | null }>(
    `SELECT google_subject FROM sf_users WHERE id = $1 LIMIT 1`,
    [session.userId],
  )

  return NextResponse.json({
    configured: googleSignInConfigured(),
    linked: Boolean(result.rows[0]?.google_subject),
    email: session.email,
  })
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const body = await request.json().catch(() => null) as { credential?: string } | null
  if (!body?.credential) {
    return NextResponse.json({ error: "Credencial Google ausente." }, { status: 400 })
  }

  try {
    const google = await verifyGoogleCredential(body.credential)
    if (google.email.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: `Use no Google a mesma conta do SaborFlow (${session.email}).` },
        { status: 409 },
      )
    }

    const used = await getPostgresPool().query<{ id: string }>(
      `SELECT id FROM sf_users WHERE google_subject = $1 AND id <> $2 LIMIT 1`,
      [google.subject, session.userId],
    )
    if (used.rowCount) {
      return NextResponse.json(
        { error: "Esta Conta Google já está vinculada a outro usuário SaborFlow." },
        { status: 409 },
      )
    }

    await getPostgresPool().query(
      `
        UPDATE sf_users
        SET google_subject = $2, updated_at = now()
        WHERE id = $1
      `,
      [session.userId, google.subject],
    )

    await getPostgresPool().query(
      `
        INSERT INTO sf_audit_log (id, organization_id, user_id, action, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'security.google_linked', 'user', $2, $3::jsonb)
      `,
      [session.organizationId, session.userId, JSON.stringify({ email: google.email })],
    ).catch(() => undefined)

    return NextResponse.json({ ok: true, linked: true, email: session.email })
  } catch (reason) {
    console.error(
      "[SaborFlow Google Link] Falha ao vincular:",
      reason instanceof Error ? reason.message : reason,
    )
    return NextResponse.json(
      { error: reason instanceof Error ? reason.message : "Não foi possível vincular o Google." },
      { status: 400 },
    )
  }
}
