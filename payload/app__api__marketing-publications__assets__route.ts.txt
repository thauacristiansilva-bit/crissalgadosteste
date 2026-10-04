import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 10 * 1024 * 1024

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}

function r2Config() {
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim()
  const bucket = String(process.env.R2_BUCKET_NAME || "").trim()
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim()
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim()
  const publicBaseUrl = cleanBaseUrl(
    String(process.env.R2_PUBLIC_BASE_URL || ""),
  )
  const endpoint =
    String(process.env.R2_ENDPOINT || "").trim() ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : "")

  if (
    !bucket ||
    !accessKeyId ||
    !secretAccessKey ||
    !publicBaseUrl ||
    !endpoint
  ) {
    return null
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    endpoint,
  }
}

async function saveToR2(
  organizationId: string,
  bytes: Buffer,
) {
  const config = r2Config()
  if (!config) return null

  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const key =
    `marketing-publications/${organizationId}/${randomUUID()}.jpg`

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  )

  return {
    mediaUrl: `${config.publicBaseUrl}/${key}`,
    name: key,
    storage: "r2",
  }
}

function marketingUploadDir() {
  const root = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "public", "uploads")

  return path.join(
    root,
    "marketing-publications",
  )
}

async function saveLocal(bytes: Buffer) {
  const dir = marketingUploadDir()
  await mkdir(dir, { recursive: true })

  const name = `${randomUUID()}.jpg`
  await writeFile(
    path.join(dir, name),
    bytes,
  )

  return {
    mediaUrl:
      `/api/marketing-publications/assets/${name}`,
    name,
    storage: "local",
  }
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      {
        error:
          "Origem da requisicao nao permitida.",
      },
      { status: 403 },
    )
  }

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessao tenant obrigatoria.",
      },
      { status: 401 },
    )
  }

  if (!canManageMarketing(session.role)) {
    return NextResponse.json(
      {
        error:
          "Seu perfil nao pode enviar artes.",
      },
      { status: 403 },
    )
  }

  try {
    const form =
      await request.formData()

    const file =
      form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Arquivo de imagem obrigatorio.",
        },
        { status: 400 },
      )
    }

    if (
      file.size <= 0 ||
      file.size > MAX_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "A imagem final deve ter no maximo 10 MB.",
        },
        { status: 400 },
      )
    }

    // O cliente normaliza tudo para JPEG antes deste upload.
    if (file.type !== "image/jpeg") {
      return NextResponse.json(
        {
          error:
            "A arte precisa chegar em JPG. Selecione a imagem novamente para o Sabor Flow converter.",
        },
        { status: 400 },
      )
    }

    const bytes =
      Buffer.from(
        await file.arrayBuffer(),
      )

    const saved =
      (await saveToR2(
        session.organizationId,
        bytes,
      )) ||
      (await saveLocal(bytes))

    return NextResponse.json(
      saved,
      { status: 201 },
    )
  } catch (error) {
    console.error(
      "[marketing-publications:asset]",
      error,
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar a arte.",
      },
      { status: 400 },
    )
  }
}
