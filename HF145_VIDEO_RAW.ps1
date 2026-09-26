$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== HOTFIX 14.5 - UPLOAD DE VIDEO SEM FORMDATA ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$storageFile = "lib\storage\help-center-media.ts"
$routeFile = "app\api\superadmin\help-center\video\route.ts"
$panelFile = "components\superadmin\help-center-admin-panel.tsx"

foreach ($file in @($storageFile, $routeFile, $panelFile)) {
  if (-not (Test-Path $file)) {
    throw "Arquivo nao encontrado: $file"
  }
}

$storage = @'
import {
  randomUUID,
} from "node:crypto"

import {
  getR2Config,
  putR2Object,
} from "@/lib/storage/r2"

const MAX_HELP_VIDEO_BYTES =
  150 * 1024 * 1024

const allowedVideoTypes = {
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const

type AllowedVideoType =
  keyof typeof allowedVideoTypes

function isAllowedVideoType(
  value: string,
): value is AllowedVideoType {
  return Object.prototype.hasOwnProperty.call(
    allowedVideoTypes,
    value,
  )
}

function looksLikeMp4(
  bytes: Uint8Array,
) {
  if (bytes.length < 12) {
    return false
  }

  return (
    String.fromCharCode(
      bytes[4],
      bytes[5],
      bytes[6],
      bytes[7],
    ) === "ftyp"
  )
}

function looksLikeWebm(
  bytes: Uint8Array,
) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
}

export async function storeHelpCenterVideo(
  input: {
    bytes: Uint8Array
    contentType: string
  },
) {
  if (!getR2Config()) {
    throw new Error(
      "Cloudflare R2 não está configurado.",
    )
  }

  const contentType =
    input.contentType
      .split(";")[0]
      .trim()
      .toLowerCase()

  if (
    !isAllowedVideoType(
      contentType,
    )
  ) {
    throw new Error(
      "Formato de vídeo inválido. Use MP4 ou WebM.",
    )
  }

  if (
    input.bytes.byteLength <= 0 ||
    input.bytes.byteLength >
      MAX_HELP_VIDEO_BYTES
  ) {
    throw new Error(
      "O vídeo deve ter no máximo 150 MB.",
    )
  }

  const signatureOk =
    contentType === "video/mp4"
      ? looksLikeMp4(
          input.bytes,
        )
      : looksLikeWebm(
          input.bytes,
        )

  if (!signatureOk) {
    throw new Error(
      "O conteúdo do arquivo não corresponde ao formato de vídeo informado.",
    )
  }

  const extension =
    allowedVideoTypes[
      contentType
    ]

  const key =
    `help-center/videos/tutorial-${Date.now()}-${randomUUID()}.${extension}`

  const url =
    await putR2Object(
      key,
      input.bytes,
      contentType,
    )

  return {
    url,
    key,
    size:
      input.bytes.byteLength,
    contentType,
  }
}
'@

[System.IO.File]::WriteAllText(
  $storageFile,
  $storage,
  [System.Text.UTF8Encoding]::new($false)
)

$route = @'
import {
  NextResponse,
} from "next/server"

import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"
import {
  storeHelpCenterVideo,
} from "@/lib/storage/help-center-media"
import {
  getSuperadminAccess,
} from "@/lib/superadmin-auth"

export const dynamic =
  "force-dynamic"

function headers() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
    "X-Content-Type-Options":
      "nosniff",
  }
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
        status:
          access ? 403 : 401,
        headers: headers(),
      },
    )
  }

  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
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

  const contentType =
    (
      request.headers.get(
        "content-type",
      ) || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase()

  if (
    contentType !== "video/mp4" &&
    contentType !== "video/webm"
  ) {
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

  try {
    const bytes =
      new Uint8Array(
        await request.arrayBuffer(),
      )

    const video =
      await storeHelpCenterVideo({
        bytes,
        contentType,
      })

    return NextResponse.json(
      {
        ok: true,
        video,
      },
      {
        headers: headers(),
      },
    )
  } catch (error) {
    console.error(
      "Falha no upload de vídeo da Central de Ajuda.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o vídeo.",
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
  $routeFile,
  $route,
  [System.Text.UTF8Encoding]::new($false)
)

$panel = [System.IO.File]::ReadAllText($panelFile)

$old = @'
    const payload =
      new FormData()

    payload.append(
      "file",
      videoFile,
    )

    const response =
      await fetch(
        "/api/superadmin/help-center/video",
        {
          method: "POST",
          body: payload,
        },
      )
'@

$new = @'
    const response =
      await fetch(
        "/api/superadmin/help-center/video",
        {
          method: "POST",
          headers: {
            "Content-Type":
              videoFile.type,
          },
          body: videoFile,
        },
      )
'@

if (-not $panel.Contains($old)) {
  throw "Nao encontrei o bloco antigo de upload FormData no painel."
}

$panel = $panel.Replace($old, $new)

[System.IO.File]::WriteAllText(
  $panelFile,
  $panel,
  [System.Text.UTF8Encoding]::new($false)
)

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
  throw "typecheck falhou."
}

npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "build falhou."
}

git restore -- next-env.d.ts 2>$null

Write-Host ""
Write-Host "HOTFIX 14.5 - UPLOAD DE VIDEO RAW - BUILD OK"
Write-Host ""
