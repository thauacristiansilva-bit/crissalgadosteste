import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"

const contentTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params
  const safeName = path.basename(name)
  if (safeName !== name) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 })
  const directory = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads")
  const filepath = path.join(directory, safeName)
  try {
    const buffer = await fs.readFile(filepath)
    const type = contentTypes[path.extname(safeName).toLowerCase()] || "application/octet-stream"
    return new NextResponse(buffer, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } })
  } catch {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 })
  }
}
