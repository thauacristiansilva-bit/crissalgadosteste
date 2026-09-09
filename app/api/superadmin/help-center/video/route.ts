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