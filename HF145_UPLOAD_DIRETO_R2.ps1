$ErrorActionPreference = "Stop"

$r2Path = "lib\storage\r2.ts"
$routePath = "app\api\superadmin\help-center\video\route.ts"
$frontPath = "components\superadmin\help-center-admin-panel.tsx"

Copy-Item $r2Path "$r2Path.bak145-direct" -Force
Copy-Item $routePath "$routePath.bak145-direct" -Force
Copy-Item $frontPath "$frontPath.bak145-direct" -Force

$utf8 = New-Object System.Text.UTF8Encoding($false)

$r2 = [System.IO.File]::ReadAllText($r2Path)

if ($r2 -notmatch '@aws-sdk/client-s3') {
    $imports = @'
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner"

'@

    $r2 = $imports + $r2
}

if ($r2 -notmatch 'createR2PresignedPutUrl') {
    $presigned = @'

export async function createR2PresignedPutUrl(
  input: {
    key: string
    contentType: string
    expiresInSeconds?: number
  },
) {
  const config = getR2Config()

  if (!config) {
    throw new Error(
      "Cloudflare R2 não está configurado no Railway.",
    )
  }

  const expiresIn = Math.min(
    Math.max(
      input.expiresInSeconds ?? 300,
      60,
    ),
    900,
  )

  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
  })

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    ContentType: input.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  })

  const uploadUrl = await getSignedUrl(
    client,
    command,
    {
      expiresIn,
    },
  )

  return {
    uploadUrl,
    publicUrl: r2PublicUrl(
      input.key,
      config,
    ),
  }
}
'@

    $r2 += $presigned
}

[System.IO.File]::WriteAllText(
    $r2Path,
    $r2,
    $utf8
)

$route = @'
import {
  randomUUID,
} from "node:crypto"

import {
  NextResponse,
} from "next/server"

import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"
import {
  createR2PresignedPutUrl,
} from "@/lib/storage/r2"
import {
  getSuperadminAccess,
} from "@/lib/superadmin-auth"

export const dynamic = "force-dynamic"

const MAX_HELP_VIDEO_BYTES =
  150 * 1024 * 1024

const allowedVideoTypes = {
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const

type AllowedVideoType =
  keyof typeof allowedVideoTypes

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

function isAllowedVideoType(
  value: string,
): value is AllowedVideoType {
  return Object.prototype.hasOwnProperty.call(
    allowedVideoTypes,
    value,
  )
}

export async function POST(
  request: Request,
) {
  const access =
    await getSuperadminAccess()

  if (
    !access ||
    access.role !== "owner"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Apenas o Superadmin proprietário pode enviar vídeos.",
      },
      {
        status: access ? 403 : 401,
        headers: headers(),
      },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Origem da requisição recusada.",
      },
      {
        status: 403,
        headers: headers(),
      },
    )
  }

  try {
    const body =
      (await request.json()) as {
        contentType?: unknown
        size?: unknown
      }

    const contentType =
      typeof body.contentType === "string"
        ? body.contentType
            .split(";")[0]
            .trim()
            .toLowerCase()
        : ""

    const size = Number(body.size)

    if (!isAllowedVideoType(contentType)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Formato de vídeo inválido. Use MP4 ou WebM.",
        },
        {
          status: 400,
          headers: headers(),
        },
      )
    }

    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      size > MAX_HELP_VIDEO_BYTES
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "O vídeo deve ter no máximo 150 MB.",
        },
        {
          status: 400,
          headers: headers(),
        },
      )
    }

    const extension =
      allowedVideoTypes[contentType]

    const key =
      `help-center/videos/tutorial-${Date.now()}-${randomUUID()}.${extension}`

    const signed =
      await createR2PresignedPutUrl({
        key,
        contentType,
        expiresInSeconds: 300,
      })

    return NextResponse.json(
      {
        ok: true,
        video: {
          uploadUrl: signed.uploadUrl,
          url: signed.publicUrl,
          key,
          size,
          contentType,
        },
      },
      {
        headers: headers(),
      },
    )
  } catch (error) {
    console.error(
      "Falha ao preparar upload de vídeo da Central de Ajuda.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o envio do vídeo.",
      },
      {
        status: 400,
        headers: headers(),
      },
    )
  }
}
'@

[System.IO.File]::WriteAllText(
    $routePath,
    $route,
    $utf8
)

$front =
  [System.IO.File]::ReadAllText(
    $frontPath
  )

$pattern =
  '(?s)  async function uploadVideoIfNeeded\(\) \{.*?\r?\n  \}\r?\n\r?\n  async function save\(\) \{'

$replacement = @'
  async function uploadVideoIfNeeded() {
    if (!videoFile) {
      return {
        url: form.videoUrl || "",
        key: "",
      }
    }

    if (
      videoFile.size >
      150 * 1024 * 1024
    ) {
      throw new Error(
        "O vídeo deve ter no máximo 150 MB.",
      )
    }

    const prepareResponse =
      await fetch(
        "/api/superadmin/help-center/video",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            contentType:
              videoFile.type,
            size:
              videoFile.size,
          }),
        },
      )

    const prepareResult =
      (await prepareResponse.json()) as {
        ok?: boolean
        error?: string
        video?: {
          uploadUrl: string
          url: string
          key: string
          size: number
          contentType: string
        }
      }

    if (
      !prepareResponse.ok ||
      !prepareResult.ok ||
      !prepareResult.video
    ) {
      throw new Error(
        prepareResult.error ||
          "Não foi possível preparar o upload do vídeo.",
      )
    }

    setMessage(
      "Enviando vídeo diretamente para o Cloudflare R2...",
    )

    const uploadResponse =
      await fetch(
        prepareResult.video.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              prepareResult.video.contentType,
            "Cache-Control":
              "public, max-age=31536000, immutable",
          },
          body: videoFile,
        },
      )

    if (!uploadResponse.ok) {
      throw new Error(
        `Falha no envio direto para o R2 (${uploadResponse.status}).`,
      )
    }

    return {
      url:
        prepareResult.video.url,
      key:
        prepareResult.video.key,
    }
  }

  async function save() {
'@

$newFront =
  [regex]::Replace(
    $front,
    $pattern,
    $replacement,
    1
  )

if ($newFront -eq $front) {
  throw "Função uploadVideoIfNeeded não encontrada."
}

[System.IO.File]::WriteAllText(
    $frontPath,
    $newFront,
    $utf8
)

Write-Host ""
Write-Host "HOTFIX 14.5 aplicado." -ForegroundColor Green
Write-Host "Upload agora será navegador -> R2." -ForegroundColor Green