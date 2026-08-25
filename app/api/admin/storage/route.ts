import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageSecurity } from "@/lib/admin-access"
import { localUploadDirectory } from "@/lib/storage/media"
import {
  getR2Config,
  mediaStorageMode,
  putR2Object,
  r2ObjectExists,
} from "@/lib/storage/r2"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

async function authorizedSession() {
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) return null
  if (!canManageSecurity(session.role, session.operationalPermissions)) return null
  return session
}

async function localImageFiles() {
  const directory = localUploadDirectory()
  const entries = await fs
    .readdir(/* turbopackIgnore: true */ directory, { withFileTypes: true })
    .catch(() => [])

  return entries
    .filter((entry) => entry.isFile() && Boolean(contentTypes[path.extname(entry.name).toLowerCase()]))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

export async function GET() {
  const session = await authorizedSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const config = getR2Config()
  const localFiles = await localImageFiles()
  const publicHost = config ? new URL(config.publicBaseUrl).host : null

  return NextResponse.json({
    mode: mediaStorageMode(),
    r2Configured: Boolean(config),
    publicHost,
    localFileCount: localFiles.length,
    uploadDirConfigured: Boolean(process.env.UPLOAD_DIR?.trim()),
    replicaReady: mediaStorageMode() === "r2" && Boolean(config) && localFiles.length === 0,
  })
}

export async function POST(request: Request) {
  const session = await authorizedSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  if (mediaStorageMode() !== "r2" || !getR2Config()) {
    return NextResponse.json(
      { error: "Ative e configure o Cloudflare R2 antes de migrar as imagens." },
      { status: 409 },
    )
  }

  const body = await request.json().catch(() => ({})) as { limit?: number }
  const limit = Math.min(100, Math.max(1, Math.floor(Number(body.limit || 50))))
  const files = await localImageFiles()
  const selected = files.slice(0, limit)
  const directory = localUploadDirectory()

  let uploaded = 0
  let alreadyStored = 0
  let removedLocal = 0
  const failures: string[] = []

  for (const name of selected) {
    const key = `legacy/${name}`
    try {
      const filepath = path.join(/* turbopackIgnore: true */ directory, name)
      if (await r2ObjectExists(key)) {
        alreadyStored += 1
      } else {
        const bytes = await fs.readFile(/* turbopackIgnore: true */ filepath)
        const contentType = contentTypes[path.extname(name).toLowerCase()] || "application/octet-stream"
        await putR2Object(key, new Uint8Array(bytes), contentType)
        uploaded += 1
      }

      // Só remove a cópia local depois de confirmar que o objeto existe no R2.
      await fs.unlink(/* turbopackIgnore: true */ filepath)
      removedLocal += 1
    } catch (error) {
      console.error(
        `[SaborFlow] Falha ao migrar mídia ${name}:`,
        error instanceof Error ? error.message : error,
      )
      failures.push(name)
    }
  }

  const remainingLocal = (await localImageFiles()).length

  return NextResponse.json({
    totalLocalBefore: files.length,
    checked: selected.length,
    uploaded,
    alreadyStored,
    removedLocal,
    remainingLocal,
    failures: failures.length,
    failureNames: failures.slice(0, 10),
    complete: remainingLocal === 0 && failures.length === 0,
  })
}
