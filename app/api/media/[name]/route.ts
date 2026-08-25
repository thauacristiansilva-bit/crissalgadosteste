import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import {
  getR2Config,
  mediaStorageMode,
  putR2Object,
  r2ObjectExists,
  r2PublicUrl,
} from "@/lib/storage/r2"
import { localUploadDirectory } from "@/lib/storage/media"

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  const safeName = path.basename(name)
  if (safeName !== name) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 })
  }

  const type =
    contentTypes[path.extname(safeName).toLowerCase()] ||
    "application/octet-stream"
  const r2Enabled = mediaStorageMode() === "r2" && Boolean(getR2Config())
  const legacyKey = `legacy/${safeName}`

  if (r2Enabled) {
    try {
      if (await r2ObjectExists(legacyKey)) {
        return NextResponse.redirect(r2PublicUrl(legacyKey), 307)
      }
    } catch (error) {
      console.warn(
        "[SaborFlow] Não foi possível consultar mídia legada no R2:",
        error instanceof Error ? error.message : error,
      )
    }
  }

  const directory = localUploadDirectory()
  const filepath = path.join(/* turbopackIgnore: true */ directory, safeName)

  try {
    const buffer = await fs.readFile(/* turbopackIgnore: true */ filepath)

    if (r2Enabled) {
      try {
        await putR2Object(legacyKey, new Uint8Array(buffer), type)
        await fs.unlink(/* turbopackIgnore: true */ filepath).catch(() => undefined)
        return NextResponse.redirect(r2PublicUrl(legacyKey), 307)
      } catch (error) {
        console.warn(
          "[SaborFlow] Falha ao migrar mídia legada para o R2 durante a leitura:",
          error instanceof Error ? error.message : error,
        )
      }
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 })
  }
}
