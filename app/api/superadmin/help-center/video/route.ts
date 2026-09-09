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
          "Apenas o Superadmin proprietÃ¡rio pode enviar vÃ­deos.",
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
          "Origem da requisiÃ§Ã£o recusada.",
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
            "Formato de vÃ­deo invÃ¡lido. Use MP4 ou WebM.",
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
            "O vÃ­deo deve ter no mÃ¡ximo 150 MB.",
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
      "Falha ao preparar upload de vÃ­deo da Central de Ajuda.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "NÃ£o foi possÃ­vel preparar o envio do vÃ­deo.",
      },
      {
        status: 400,
        headers: headers(),
      },
    )
  }
}