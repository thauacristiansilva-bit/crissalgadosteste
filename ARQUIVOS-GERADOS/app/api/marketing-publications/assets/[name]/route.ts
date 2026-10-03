import { readFile } from "fs/promises"
import path from "path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const contentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

function marketingUploadDir() {
  const root = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "public", "uploads")
  return path.join(root, "marketing-publications")
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  if (!/^[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp)$/i.test(name)) {
    return new Response("Arquivo invalido.", { status: 400 })
  }

  try {
    const bytes = await readFile(path.join(marketingUploadDir(), name))
    const extension = name.split(".").pop()?.toLowerCase() || "png"
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypes[extension] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response("Arte nao encontrada.", { status: 404 })
  }
}
