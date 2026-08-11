import { NextResponse } from "next/server"
import {
  resolvePublicOrganizationForRequest,
} from "@/lib/public-tenant"
import {
  getPublicStoreForOrganization,
} from "@/lib/public-store-db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const organization =
    await resolvePublicOrganizationForRequest(
      request,
    )

  if (!organization) {
    return NextResponse.json(
      { error: "Loja não encontrada." },
      { status: 404 },
    )
  }

  try {
    return NextResponse.json(
      await getPublicStoreForOrganization(
        organization,
      ),
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Loja indisponível.",
      },
      { status: 503 },
    )
  }
}
