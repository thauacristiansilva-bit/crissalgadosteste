import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createTenantFeedback,
  getTenantFeedbacks,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canViewFeedback,
} from "@/lib/tenant-permissions"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Sessão tenant obrigatória." },
      { status: 401 },
    )
  }

  if (!(await isTenantOperationsReady(
    session.organizationId,
  ).catch(() => false))) {
    return NextResponse.json(
      { error: "Operações PostgreSQL indisponíveis para esta empresa." },
      { status: 503 },
    )
  }

  if (!canViewFeedback(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode visualizar avaliações.",
      },
      { status: 403 },
    )
  }

  return NextResponse.json({
    feedbacks: await getTenantFeedbacks(
      session.organizationId,
    ),
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        orderReference?: string
        rating?: number
        comment?: string
      }
    | null

  if (!body?.orderReference || !body.rating) {
    return NextResponse.json(
      { error: "Avaliação incompleta." },
      { status: 400 },
    )
  }

  try {
    const organization =
      await resolvePublicOrganizationForRequest(
        request,
      )

    if (!organization) {
      throw new Error(
        "Empresa não identificada. Abra a loja pelo link /loja/{slug}.",
      )
    }

    return runWithTenantRlsScope(
      [organization.id],
      undefined,
      async () => {
        const ready = await isTenantOperationsReady(
          organization.id,
        ).catch(() => false)

        if (!ready) {
          throw new Error(
            "Avaliações ainda não foram habilitadas para esta empresa.",
          )
        }

        const feedback = await createTenantFeedback(
          organization.id,
          {
            orderReference: body.orderReference,
            rating: body.rating,
            comment: body.comment,
          },
        )

        return NextResponse.json(
          { feedback },
          { status: 201 },
        )
      },
      "public-store",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao avaliar.",
      },
      { status: 400 },
    )
  }
}
