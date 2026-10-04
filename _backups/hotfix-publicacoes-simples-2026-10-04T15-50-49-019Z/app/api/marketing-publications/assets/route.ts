import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 8 * 1024 * 1024
const allowed = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
])

function marketingUploadDir() {
  const root = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "public", "uploads")
  return path.join(root, "marketing-publications")
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisicao nao permitida." },
      { status: 403 },
    )
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Sessao tenant obrigatoria." }, { status: 401 })
  }
  if (!canManageMarketing(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode enviar artes." },
      { status: 403 },
    )
  }

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo de imagem obrigatorio." }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "A imagem deve ter no maximo 8 MB." }, { status: 400 })
    }
    const extension = allowed.get(file.type)
    if (!extension) {
      return NextResponse.json({ error: "Use PNG, JPG ou WEBP." }, { status: 400 })
    }

    const dir = marketingUploadDir()
    await mkdir(dir, { recursive: true })
    const name = `${randomUUID()}.${extension}`
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, name), bytes)

    return NextResponse.json({
      mediaUrl: `/api/marketing-publications/assets/${name}`,
      name,
    }, { status: 201 })
  } catch (error) {
    console.error("[marketing-publications:asset]", error)
    return NextResponse.json(
      { error: "Nao foi possivel salvar a arte." },
      { status: 400 },
    )
  }
}
