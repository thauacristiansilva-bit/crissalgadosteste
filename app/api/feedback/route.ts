import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  createFeedback as createLegacyFeedback,
  getFeedbacks as getLegacyFeedbacks,
  syncLegacyFeedbackFromTenant,
} from "@/lib/db"
import {
  createTenantFeedback,
  getTenantFeedbacks,
  isTenantOperationsReady,
} from "@/lib/operations-db"
import {
  getCurrentDeploymentOrganizationId,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  canViewFeedback,
} from "@/lib/tenant-permissions"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const session = await getVerifiedTenantSession()

  if (
    session &&
    (await isTenantOperationsReady(
      session.organizationId,
    ).catch(() => false))
  ) {
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

  return NextResponse.json({
    feedbacks: await getLegacyFeedbacks(),
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
    const organizationId =
      await getCurrentDeploymentOrganizationId()

    const ready =
      organizationId &&
      (await isTenantOperationsReady(
        organizationId,
      ).catch(() => false))

    if (!organizationId || !ready) {
      const feedback = await createLegacyFeedback({
        orderReference: body.orderReference,
        rating: body.rating,
        comment: body.comment,
      })

      return NextResponse.json(
        { feedback },
        { status: 201 },
      )
    }

    const feedback = await createTenantFeedback(
      organizationId,
      {
        orderReference: body.orderReference,
        rating: body.rating,
        comment: body.comment,
      },
    )

    if (
      await isCurrentDeploymentOrganization(
        organizationId,
      )
    ) {
      await syncLegacyFeedbackFromTenant(feedback)
    }

    return NextResponse.json(
      { feedback },
      { status: 201 },
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
