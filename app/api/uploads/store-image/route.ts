import { promises as fs } from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageOrganizationSettings } from "@/lib/tenant-permissions"
import {
  detectSafeImageType,
  safeImageExtension,
} from "@/lib/security/image-validation"

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  if (!canManageOrganizationSettings(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode alterar imagens da empresa." },
      { status: 403 },
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 })
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 8 MB." },
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

  const directory =
    process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(directory, { recursive: true })

  const filename = `brand-${Date.now()}-${crypto.randomUUID()}.${safeImageExtension(detectedType)}`
  await fs.writeFile(path.join(directory, filename), bytes)

  return NextResponse.json({ url: `/api/media/${filename}` }, { status: 201 })
}
