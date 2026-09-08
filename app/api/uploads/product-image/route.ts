import { NextResponse } from "next/server"
import { getVerifiedTenantSession, canManageCatalog } from "@/lib/tenant-access"
import { detectSafeImageType } from "@/lib/security/image-validation"
import { storeImage } from "@/lib/storage/media"
import { requestBodyTooLarge } from "@/lib/security/input-validation"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 512 * 1024

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

  if (requestBodyTooLarge(request, MAX_REQUEST_BYTES)) {
    return NextResponse.json(
      { error: "Upload muito grande." },
      { status: 413 },
    )
  }

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: "Formulário de upload inválido." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 })
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "A imagem deve ter entre 1 byte e 5 MB." },
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
