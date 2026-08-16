import { NextResponse } from "next/server"
import { recordCourierLiveLocation } from "@/lib/delivery-tracking-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  if (session.role !== "courier") {
    return NextResponse.json(
      { error: "Somente o entregador autenticado pode publicar a própria localização." },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | {
        latitude?: number
        longitude?: number
        accuracyMeters?: number | null
      }
    | null

  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Localização inválida." }, { status: 400 })
  }

  return runWithTenantRlsScope(
    [session.organizationId],
    session.userId,
    async () => {
      try {
        const location = await recordCourierLiveLocation({
          organizationId: session.organizationId,
          userId: session.userId,
          latitude,
          longitude,
          accuracyMeters:
            body?.accuracyMeters == null ? null : Number(body.accuracyMeters),
        })

        return NextResponse.json({ ok: true, location })
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível atualizar o GPS.",
          },
          { status: 409 },
        )
      }
    },
    "tenant-session",
  )
}
