import { NextResponse } from "next/server"
import { detectSafeImageType } from "@/lib/security/image-validation"
import { requestBodyTooLarge } from "@/lib/security/input-validation"
import { storeImage } from "@/lib/storage/media"
import { addMigrationAsset, getMigrationIntake } from "@/lib/migration-intake"
import { MIGRATION_MAX_ASSETS, MIGRATION_MAX_BATCH } from "@/lib/migration-intake-types"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 512 * 1024

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode enviar material de migração." }, { status: 403 })
  if (requestBodyTooLarge(request, MAX_REQUEST_BYTES)) return NextResponse.json({ error: "Upload muito grande." }, { status: 413 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Formulário de upload inválido." }, { status: 400 })
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Cada imagem deve ter no máximo 8 MB." }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedType = detectSafeImageType(bytes)
  if (!detectedType) return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WEBP válida." }, { status: 400 })
  const declaredType = file.type?.toLowerCase()
  if (declaredType && declaredType !== detectedType) return NextResponse.json({ error: "O conteúdo da imagem não corresponde ao tipo informado." }, { status: 400 })

  try {
    const current = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => getMigrationIntake(session.organizationId, session.userId),
      "tenant-session",
    )
    if (current.assets.length >= MIGRATION_MAX_ASSETS) {
      return NextResponse.json({ error: `O limite desta migração é de ${MIGRATION_MAX_ASSETS} imagens.` }, { status: 400 })
    }
    const stored = await storeImage({
      organizationId: session.organizationId,
      area: "migration",
      bytes,
      contentType: detectedType,
      filenamePrefix: "migration",
    })
    const intake = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () => addMigrationAsset(session.organizationId, session.userId, {
        url: stored.url,
        filename: file.name || "imagem",
        contentType: detectedType,
        size: file.size,
      }),
      "tenant-session",
    )
    return NextResponse.json({ ok: true, intake, maxBatch: MIGRATION_MAX_BATCH }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01") return NextResponse.json({ error: "A migration 041 ainda precisa ser aplicada." }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a imagem." }, { status: 400 })
  }
}
