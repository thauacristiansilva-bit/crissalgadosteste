import {
  NextResponse,
} from "next/server"

import {
  getWhatsAppMetaWebhookConnection,
  recordWhatsAppMetaWebhook,
  verifyWhatsAppMetaChallenge,
  verifyWhatsAppMetaSignature,
  whatsappMetaPayloadMatchesConnection,
} from "@/lib/whatsapp-meta-webhook"

export const runtime =
  "nodejs"

export const dynamic =
  "force-dynamic"

const MAX_BODY_BYTES =
  1024 * 1024

type RouteContext = {
  params: Promise<{
    connectionId: string
  }>
}

function json(
  body: Record<
    string,
    unknown
  >,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  )
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  const {
    connectionId,
  } =
    await context.params

  const url =
    new URL(
      request.url,
    )

  const mode =
    url.searchParams.get(
      "hub.mode",
    ) || ""

  const token =
    url.searchParams.get(
      "hub.verify_token",
    ) || ""

  const challenge =
    url.searchParams.get(
      "hub.challenge",
    ) || ""

  if (
    mode !== "subscribe" ||
    !challenge
  ) {
    return new Response(
      "Invalid verification request.",
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store",
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      },
    )
  }

  try {
    const connection =
      await getWhatsAppMetaWebhookConnection(
        connectionId,
        {
          requireActive:
            false,
        },
      )

    if (!connection) {
      return new Response(
        "Webhook not found.",
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        },
      )
    }

    if (
      !verifyWhatsAppMetaChallenge(
        connection,
        token,
      )
    ) {
      return new Response(
        "Forbidden.",
        {
          status: 403,
          headers: {
            "Cache-Control":
              "no-store",
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        },
      )
    }

    return new Response(
      challenge,
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      },
    )
  } catch (error) {
    console.error(
      "[whatsapp-meta:webhook:GET]",
      error,
    )

    return new Response(
      "Webhook verification failed.",
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      },
    )
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const {
    connectionId,
  } =
    await context.params

  const contentLength =
    Number(
      request.headers.get(
        "content-length",
      ) || 0,
    )

  if (
    Number.isFinite(
      contentLength,
    ) &&
    contentLength >
      MAX_BODY_BYTES
  ) {
    return json(
      {
        ok: false,
        error:
          "Webhook muito grande.",
      },
      413,
    )
  }

  try {
    const rawBody =
      await request.text()

    if (
      Buffer.byteLength(
        rawBody,
        "utf8",
      ) >
      MAX_BODY_BYTES
    ) {
      return json(
        {
          ok: false,
          error:
            "Webhook muito grande.",
        },
        413,
      )
    }

    const connection =
      await getWhatsAppMetaWebhookConnection(
        connectionId,
      )

    if (!connection) {
      return json(
        {
          ok: false,
          error:
            "Webhook não encontrado ou conexão desativada.",
        },
        404,
      )
    }

    const signature =
      request.headers.get(
        "x-hub-signature-256",
      )

    if (
      !verifyWhatsAppMetaSignature(
        connection,
        rawBody,
        signature,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "Assinatura da Meta inválida.",
        },
        401,
      )
    }

    const payload =
      JSON.parse(
        rawBody,
      ) as unknown

    if (
      !payload ||
      typeof payload !==
        "object" ||
      Array.isArray(
        payload,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "Payload inválido.",
        },
        400,
      )
    }

    const objectPayload =
      payload as Record<
        string,
        unknown
      >

    if (
      !whatsappMetaPayloadMatchesConnection(
        connection,
        objectPayload,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "Evento não pertence ao número desta conexão.",
        },
        403,
      )
    }

    const result =
      await recordWhatsAppMetaWebhook(
        connection,
        objectPayload,
        rawBody,
      )

    return json({
      ok: true,
      received: true,
      events:
        result.events,
      inserted:
        result.inserted,
      duplicates:
        result.duplicates,
    })
  } catch (error) {
    console.error(
      "[whatsapp-meta:webhook:POST]",
      error,
    )

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao receber webhook da Meta.",
      },
      400,
    )
  }
}
