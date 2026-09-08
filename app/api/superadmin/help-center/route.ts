import { NextResponse } from "next/server"
import {
  deleteHelpCenterAdminArticle,
  getHelpCenterAdminData,
  saveHelpCenterAdminArticle,
} from "@/lib/help-center-admin-db"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { getSuperadminAccess } from "@/lib/superadmin-auth"

export const dynamic = "force-dynamic"

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

function canWrite(role: string) {
  return role === "owner"
}

export async function GET() {
  const access = await getSuperadminAccess()
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: headers() },
    )
  }

  try {
    return NextResponse.json(
      {
        ok: true,
        data: await getHelpCenterAdminData(),
        canWrite: canWrite(access.role),
      },
      { headers: headers() },
    )
  } catch (error) {
    console.error("Falha ao carregar tutoriais do Superadmin.", error)
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar os tutoriais." },
      { status: 500, headers: headers() },
    )
  }
}

export async function POST(request: Request) {
  const access = await getSuperadminAccess()

  if (!access || !canWrite(access.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Apenas o Superadmin proprietário pode alterar tutoriais.",
      },
      { status: access ? 403 : 401, headers: headers() },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da requisição recusada." },
      { status: 403, headers: headers() },
    )
  }

  let body: Record<string, unknown> | null = null
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = null
  }

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos." },
      { status: 400, headers: headers() },
    )
  }

  try {
    return NextResponse.json(
      { ok: true, article: await saveHelpCenterAdminArticle(body) },
      { headers: headers() },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o tutorial.",
      },
      { status: 400, headers: headers() },
    )
  }
}

export async function DELETE(request: Request) {
  const access = await getSuperadminAccess()

  if (!access || !canWrite(access.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Apenas o Superadmin proprietário pode excluir tutoriais.",
      },
      { status: access ? 403 : 401, headers: headers() },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da requisição recusada." },
      { status: 403, headers: headers() },
    )
  }

  let id = ""
  try {
    const body = (await request.json()) as { id?: unknown }
    id = String(body.id || "").trim()
  } catch {
    id = ""
  }

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Tutorial inválido." },
      { status: 400, headers: headers() },
    )
  }

  const deleted = await deleteHelpCenterAdminArticle(id)

  return NextResponse.json(
    {
      ok: deleted,
      error: deleted ? undefined : "Tutorial não encontrado.",
    },
    { status: deleted ? 200 : 404, headers: headers() },
  )
}