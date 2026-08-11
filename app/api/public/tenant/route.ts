import { NextResponse } from "next/server"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const organization =
    await resolvePublicOrganizationForRequest(
      request,
    )

  if (!organization) {
    return NextResponse.json(
      {
        ok: false,
        error: "Loja não encontrada.",
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      publicStoreEnabled:
        organization.publicStoreEnabled,
      publicOrderingEnabled:
        organization.publicOrderingEnabled,
    },
  })
}
