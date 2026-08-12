import { NextResponse } from "next/server"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canManageSecurity,
} from "@/lib/admin-access"
import { assertDemoActionAllowed, demoPolicyErrorStatus } from "@/lib/demo-policy"
import {
  createPrintAgent,
  listPrintAgents,
  revokePrintAgent,
} from "@/lib/organization-security-db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageSecurity(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  return NextResponse.json({
    printAgents:
      await listPrintAgents(
        session.organizationId,
      ),
  })
}

export async function POST(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageSecurity(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { name?: string }
    | null

  try {
    await assertDemoActionAllowed(session.organizationId, "external-print")
    const agent =
      await createPrintAgent({
        organizationId:
          session.organizationId,
        name: body?.name || "",
        createdByUserId:
          session.userId,
      })

    return NextResponse.json(
      {
        agent,
        warning:
          "O token é exibido somente agora. Guarde-o no computador do agente de impressão.",
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o agente.",
      },
      { status: demoPolicyErrorStatus(error) },
    )
  }
}

export async function DELETE(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    !canManageSecurity(session.role)
  ) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: session ? 403 : 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { id?: string }
    | null

  if (!body?.id) {
    return NextResponse.json(
      {
        error:
          "Agente inválido.",
      },
      { status: 400 },
    )
  }

  try {
    await assertDemoActionAllowed(session.organizationId, "external-print")
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ação bloqueada na demonstração." },
      { status: demoPolicyErrorStatus(error) },
    )
  }

  const revoked =
    await revokePrintAgent(
      session.organizationId,
      body.id,
    )

  return NextResponse.json({
    ok: revoked,
  })
}
