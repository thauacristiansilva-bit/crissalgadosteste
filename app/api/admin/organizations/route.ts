import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/lib/auth"
import {
  createOrganizationForUser,
} from "@/lib/organization-onboarding"
import {
  listOrganizationMembershipsForUserId,
} from "@/lib/tenant-context"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import { billingErrorStatus } from "@/lib/billing-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function canCreateOrganization(
  role: string,
) {
  return role === "owner"
}

export async function GET() {
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

  const organizations =
    await listOrganizationMembershipsForUserId(
      session.userId,
    )

  return NextResponse.json({
    activeOrganizationId:
      session.organizationId,
    organizations,
  })
}

export async function POST(
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
    !canCreateOrganization(
      session.role,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Somente o proprietário da conta contratante pode adicionar outra loja.",
      },
      { status: 403 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        personType?: "PF" | "PJ"
        document?: string
        tradeName?: string
        legalName?: string
        industry?: string
        phone?: string
        email?: string
        city?: string
        state?: string
      }
    | null

  if (
    !body?.document ||
    !body?.tradeName
  ) {
    return NextResponse.json(
      {
        error:
          "Documento e nome da empresa são obrigatórios.",
      },
      { status: 400 },
    )
  }

  try {
    const context =
      await createOrganizationForUser(
        session.userId,
        session.email,
        {
          personType:
            body.personType === "PF"
              ? "PF"
              : "PJ",
          document:
            body.document,
          tradeName:
            body.tradeName,
          legalName:
            body.legalName,
          industry:
            body.industry,
          phone: body.phone,
          email: body.email,
          city: body.city,
          state: body.state,
        },
      )

    const response =
      NextResponse.json(
        {
          ok: true,
          organization: {
            id: context.organizationId,
            name:
              context.organizationName,
            slug:
              context.organizationSlug,
            role: context.role,
            publicOrderingEnabled:
              false,
          },
          switched: true,
        },
        { status: 201 },
      )

    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createSessionToken(context),
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge:
          60 * 60 * 24 * 7,
      },
    )

    return response
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a empresa.",
      },
      { status: billingErrorStatus(error) },
    )
  }
}
