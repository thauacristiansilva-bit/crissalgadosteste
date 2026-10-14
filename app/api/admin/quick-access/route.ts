import { randomBytes, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getPostgresPool } from "@/lib/postgres"
import { runWithRlsBypass } from "@/lib/rls-context"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { hashAdminPassword } from "@/lib/admin-user-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// sf-extra-access-20261014: login separado e senha gerada no servidor.
export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return NextResponse.json({error: "Origem não autorizada."}, {status: 403})
  const session = await getVerifiedTenantSession()
  if (!session) return NextResponse.json({error: "Entre como administrador."}, {status: 401})
  if (session.role !== "owner") return NextResponse.json({error: "Somente o proprietário pode criar outro acesso."}, {status: 403})
  if (session.organizationSlug !== "cris-salgados") return NextResponse.json({error: "A criação está restrita à Cris Salgados."}, {status: 403})

  const body = await request.json().catch(() => null) as {name?: unknown, email?: unknown} | null
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({error: "Informe nome e e-mail válidos."}, {status: 400})
  }
  const password = `Sf!${randomBytes(20).toString("base64url")}A9`
  const hash = hashAdminPassword(password)

  try {
    await runWithRlsBypass(async () => {
      const client = await getPostgresPool().connect()
      try {
        await client.query("BEGIN")
        const existing = await client.query("SELECT id FROM sf_users WHERE lower(email) = lower($1) LIMIT 1", [email])
        if (existing.rows.length) throw new Error("EMAIL_EXISTS")
        const organization = await client.query("SELECT id FROM sf_organizations WHERE id = $1 AND slug = 'cris-salgados' LIMIT 1", [session.organizationId])
        if (!organization.rows.length) throw new Error("ORGANIZATION_NOT_FOUND")
        const id = randomUUID()
        await client.query("INSERT INTO sf_users (id, name, email, password_hash, status) VALUES ($1,$2,$3,$4,'active')", [id, name, email, hash])
        await client.query("INSERT INTO sf_memberships (user_id, organization_id, role, status) VALUES ($1,$2,'admin','active')", [id, session.organizationId])
        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined)
        throw error
      } finally { client.release() }
    })
    return NextResponse.json({email, password}, {headers: {"Cache-Control": "no-store"}})
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") return NextResponse.json({error: "E-mail já cadastrado; nenhum usuário foi substituído."}, {status: 409})
    if (error instanceof Error && error.message === "ORGANIZATION_NOT_FOUND") return NextResponse.json({error: "Loja Cris Salgados não encontrada."}, {status: 404})
    if ((error as {code?: string})?.code === "23505") return NextResponse.json({error: "Esse acesso já existe."}, {status: 409})
    console.error("[SaborFlow] Falha ao criar acesso:", error instanceof Error ? error.message : "Erro interno")
    return NextResponse.json({error: "Não foi possível criar o acesso; confira as tabelas do PostgreSQL."}, {status: 500})
  }
}
