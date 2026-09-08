import { NextResponse } from "next/server"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { storeHelpCenterVideo } from "@/lib/storage/help-center-media"
import { getSuperadminAccess } from "@/lib/superadmin-auth"

export const dynamic = "force-dynamic"

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

export async function POST(request: Request) {
  const access = await getSuperadminAccess()

  if (!access || access.role !== "owner") {
    return NextResponse.json(
      {
        ok: false,
        error: "Apenas o Superadmin proprietário pode enviar vídeos.",
      },
      { status: access ? 403 : 401, headers: headers() },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da requisição recusada." },
      { status: 403, headers: headers() },
    )
  }

  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Selecione um vídeo." },
        { status: 400, headers: headers() },
      )
    }

    return NextResponse.json(
      { ok: true, video: await storeHelpCenterVideo(file) },
      { headers: headers() },
    )
  } catch (error) {
    console.error("Falha no upload de vídeo da Central de Ajuda.", error)
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o vídeo.",
      },
      { status: 400, headers: headers() },
    )
  }
}