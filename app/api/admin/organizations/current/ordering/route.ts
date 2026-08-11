import { NextResponse } from "next/server"
import {
  setOrganizationOrderingEnabled,
} from "@/lib/organization-onboarding"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export async function PATCH(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Não autorizado.",
      },
      { status: 401 },
    )
  }

  if (
    session.role !== "owner" &&
    session.role !== "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "Seu perfil não pode alterar a publicação dos pedidos.",
      },
      { status: 403 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { enabled?: boolean }
    | null

  if (
    typeof body?.enabled !==
    "boolean"
  ) {
    return NextResponse.json(
      {
        error:
          "Informe se os pedidos online devem ficar ativos.",
      },
      { status: 400 },
    )
  }

  try {
    const readiness =
      await setOrganizationOrderingEnabled(
        session.organizationId,
        body.enabled,
      )

    return NextResponse.json({
      ok: true,
      enabled: body.enabled,
      readiness,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível alterar os pedidos online.",
      },
      { status: 400 },
    )
  }
}
