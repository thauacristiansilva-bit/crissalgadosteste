import { readFile, stat } from "node:fs/promises"
import { basename, join } from "node:path"
import { getR2Config } from "@/lib/storage/r2"
import { localUploadDirectory } from "@/lib/storage/media"

/** Reads only the brand image already owned by this tenant. Never fetch arbitrary user URLs. */
export async function tenantBrandImage(organizationId: string, imageUrl: string) {
  if (!imageUrl) return null
  const type = /\.(png|jpe?g|webp)(?:\?|$)/i.exec(imageUrl)?.[1]?.toLowerCase()
  if (!type) return null
  const mimeType = type === "png" ? "image/png" : type === "webp" ? "image/webp" : "image/jpeg"
  const maxBytes = 2_000_000
  let bytes: Buffer
  const localMatch = /^\/api\/media\/([\w-]+\.(?:png|jpe?g|webp))$/i.exec(imageUrl)
  if (localMatch) {
    const name = localMatch[1]
    if (basename(name) !== name) return null
    const file = join(localUploadDirectory(), name)
    if ((await stat(file)).size > maxBytes) return null
    bytes = await readFile(file)
  } else {
    const r2 = getR2Config()
    const prefix = r2 && `${r2.publicBaseUrl}/organizations/${organizationId}/brand/`
    if (!prefix || !imageUrl.startsWith(prefix) || imageUrl.slice(prefix.length).includes("/")) return null
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(6000), cache: "no-store" })
    if (!response.ok || Number(response.headers.get("content-length") || 0) > maxBytes || !response.body) return null
    const reader = response.body.getReader()
    const parts: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > maxBytes) return null
        parts.push(chunk.value)
      }
    } finally { await reader.cancel().catch(() => undefined) }
    bytes = Buffer.concat(parts)
  }
  if (bytes.length === 0 || bytes.length > maxBytes) return null
  return { inlineData: { mimeType, data: bytes.toString("base64") } }
}
