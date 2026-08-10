import { promises as fs } from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 })
  const extension = allowedTypes[file.type]
  if (!extension) return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WEBP." }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 })

  const directory = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(directory, { recursive: true })
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()))
  return NextResponse.json({ url: `/api/media/${filename}` }, { status: 201 })
}
