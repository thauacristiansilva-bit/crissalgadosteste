import { NextResponse } from "next/server"
import { getPostgresPool } from "@/lib/postgres"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TutorialFeedbackBody = {
  tutorialId?: string
  tutorialTitle?: string
  rating?: number | null
  helpful?: "yes" | "partly" | "no" | null
  comment?: string
  stepCount?: number
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const body = await request.json().catch(() => null) as TutorialFeedbackBody | null
  if (!body) return NextResponse.json({ error: "Avaliação inválida." }, { status: 400 })

  const tutorialId = cleanText(body.tutorialId, 80)
  const tutorialTitle = cleanText(body.tutorialTitle, 160)
  const comment = cleanText(body.comment, 1000)
  const rating = body.rating == null ? null : Number(body.rating)
  const helpful = body.helpful ?? null
  const stepCount = Math.max(0, Math.min(100, Math.floor(Number(body.stepCount || 0))))

  if (!tutorialId || !/^[a-z0-9-]+$/i.test(tutorialId)) {
    return NextResponse.json({ error: "Tutorial inválido." }, { status: 400 })
  }
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: "A nota deve estar entre 1 e 5." }, { status: 400 })
  }
  if (helpful !== null && !["yes", "partly", "no"].includes(helpful)) {
    return NextResponse.json({ error: "Resposta de utilidade inválida." }, { status: 400 })
  }
  if (rating === null && helpful === null && !comment) {
    return NextResponse.json({ error: "Avaliação vazia." }, { status: 400 })
  }

  try {
    await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        await getPostgresPool().query(
          `INSERT INTO sf_tutorial_feedback (
             organization_id,
             user_id,
             tutorial_id,
             tutorial_title,
             rating,
             helpful,
             comment,
             step_count
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            session.organizationId,
            session.userId,
            tutorialId,
            tutorialTitle,
            rating,
            helpful,
            comment,
            stepCount,
          ],
        )
      },
      "tenant-session",
    )
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === "42P01") {
      return NextResponse.json({ error: "A migration do feedback dos tutoriais ainda precisa ser aplicada." }, { status: 503 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a avaliação." }, { status: 400 })
  }
}
