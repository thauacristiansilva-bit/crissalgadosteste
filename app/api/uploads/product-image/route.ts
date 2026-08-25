import { NextResponse } from "next/server"
import { getVerifiedTenantSession, canManageCatalog } from "@/lib/tenant-access"
import { detectSafeImageType } from "@/lib/security/image-validation"
import { storeImage } from "@/lib/storage/media"

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  if (!canManageCatalog(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar imagens do cardápio." },
      { status: 403 },
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 5 MB." },
      { status: 400 },
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedType = detectSafeImageType(bytes)
  if (!detectedType) {
    return NextResponse.json(
      { error: "Arquivo inválido. Use uma imagem JPG, PNG ou WEBP real." },
      { status: 400 },
    )
  }

  const declaredType = file.type?.toLowerCase()
  if (declaredType && declaredType !== detectedType) {
    return NextResponse.json(
      { error: "O conteúdo da imagem não corresponde ao tipo informado." },
      { status: 400 },
    )
  }

  try {
    const stored = await storeImage({
      organizationId: session.organizationId,
      area: "products",
      bytes,
      contentType: detectedType,
      filenamePrefix: "product",
    })

    return NextResponse.json(
      { url: stored.url, storage: stored.storage },
      { status: 201 },
    )
  } catch (error) {
    console.error(
      "[SaborFlow] Falha no upload de imagem de produto:",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: "Não foi possível salvar a imagem agora." },
      { status: 503 },
    )
  }
}
