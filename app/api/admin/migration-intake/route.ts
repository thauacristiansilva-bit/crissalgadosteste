import { NextResponse } from "next/server"
import {
  getMigrationIntake,
  removeMigrationAsset,
  saveMigrationIntake,
  submitMigrationIntake,
} from "@/lib/migration-intake"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function ownerSession() {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) return { error: "Não autorizado.", status: 401 as const }
  if (session.role !== "owner") return { error: "Somente o proprietário pode preparar a migração da empresa.", status: 403 as const }
  return { session }
}

function schemaMissing(error: unknown) {
  return (error as { code?: string })?.code === "42P01"
}

export async function GET() {
  const auth = await ownerSession()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const intake = await runWithTenantRlsScope(
      [auth.session.organizationId],
      auth.session.userId,
      () => getMigrationIntake(auth.session.organizationId, auth.session.userId),
      "tenant-session",
    )
    return NextResponse.json({ intake })
  } catch (error) {
    if (schemaMissing(error)) return NextResponse.json({ error: "A migration 041 ainda precisa ser aplicada." }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar a migração." }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const auth = await ownerSession()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  try {
    const intake = await runWithTenantRlsScope(
      [auth.session.organizationId],
      auth.session.userId,
      () => saveMigrationIntake(auth.session.organizationId, auth.session.userId, body),
      "tenant-session",
    )
    return NextResponse.json({ ok: true, intake })
  } catch (error) {
    if (schemaMissing(error)) return NextResponse.json({ error: "A migration 041 ainda precisa ser aplicada." }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a migração." }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const auth = await ownerSession()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => null) as { action?: string; assetId?: string } | null
  try {
    const intake = await runWithTenantRlsScope(
      [auth.session.organizationId],
      auth.session.userId,
      async () => {
        if (body?.action === "submit") return submitMigrationIntake(auth.session.organizationId, auth.session.userId)
        if (body?.action === "remove-asset" && body.assetId) return removeMigrationAsset(auth.session.organizationId, auth.session.userId, body.assetId)
        throw new Error("Ação inválida.")
      },
      "tenant-session",
    )
    return NextResponse.json({ ok: true, intake })
  } catch (error) {
    if (schemaMissing(error)) return NextResponse.json({ error: "A migration 041 ainda precisa ser aplicada." }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível concluir a ação." }, { status: 400 })
  }
}
