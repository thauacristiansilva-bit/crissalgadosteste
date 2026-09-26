import crypto from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  getR2Config,
  mediaStorageMode,
  putR2Object,
} from "@/lib/storage/r2"
import {
  safeImageExtension,
  type SafeImageType,
} from "@/lib/security/image-validation"

export type MediaArea = "products" | "brand"

function cleanOrganizationId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-")
}

export function localUploadDirectory() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads")
}

export async function storeImage(input: {
  organizationId: string
  area: MediaArea
  bytes: Uint8Array
  contentType: SafeImageType
  filenamePrefix?: string
}) {
  const extension = safeImageExtension(input.contentType)
  const prefix = input.filenamePrefix?.replace(/[^a-zA-Z0-9_-]/g, "-") || input.area
  const filename = `${prefix}-${Date.now()}-${crypto.randomUUID()}.${extension}`

  if (mediaStorageMode() === "r2") {
    if (!getR2Config()) {
      throw new Error(
        "MEDIA_STORAGE_MODE está como r2, mas as credenciais/publicação do Cloudflare R2 estão incompletas.",
      )
    }

    const key = `organizations/${cleanOrganizationId(input.organizationId)}/${input.area}/${filename}`
    const url = await putR2Object(key, input.bytes, input.contentType)
    return { url, storage: "r2" as const, key }
  }

  const directory = localUploadDirectory()
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, filename), input.bytes)
  return {
    url: `/api/media/${filename}`,
    storage: "local" as const,
    key: filename,
  }
}
