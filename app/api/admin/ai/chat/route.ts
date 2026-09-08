import { NextResponse } from "next/server"

import {
  generateGeminiText,
  type GeminiChatMessage,
} from "@/lib/ai/gemini"
import {
  SABORFLOW_AI_SYSTEM_PROMPT,
} from "@/lib/ai/saborflow-assistant"
import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 32 * 1024
const MAX_MESSAGES = 6
const MAX_MESSAGE_CHARS = 4_000
const MAX_TOTAL_CHARS = 8_000

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

function fail(
  error: string,
  status: number,
) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: headers() },
  )
}

function normalizeMessages(
  value: unknown,
): GeminiChatMessage[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_MESSAGES
  ) {
    return null
  }

  const messages: GeminiChatMessage[] = []
  let total = 0

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return null
    }

    const role =
      (item as { role?: unknown }).role
    const content =
      (item as { content?: unknown })
        .content

    if (
      role !== "user" &&
      role !== "assistant"
    ) {
      return null
    }

    if (typeof content !== "string") {
      return null
    }

    const text = content.trim()

    if (
      !text ||
      text.length > MAX_MESSAGE_CHARS
    ) {
      return null
    }

    total += text.length

    if (total > MAX_TOTAL_CHARS) {
      return null
    }

    messages.push({
      role:
        role === "assistant"
          ? "model"
          : "user",
      text,
    })
  }

  if (
    messages[messages.length - 1]
      ?.role !== "user"
  ) {
    return null
  }

  return messages
}

export async function POST(
  request: Request,
) {
  if (!requestIsSameOrigin(request)) {
    return fail(
      "Origem da requisiÃ§Ã£o nÃ£o permitida.",
      403,
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return fail(
      "NÃ£o autorizado.",
      401,
    )
  }

  const raw = await request.text()

  if (
    Buffer.byteLength(raw, "utf8") >
    MAX_BODY_BYTES
  ) {
    return fail(
      "Mensagem muito grande.",
      413,
    )
  }

  let body: unknown

  try {
    body = JSON.parse(raw)
  } catch {
    return fail(
      "JSON invÃ¡lido.",
      400,
    )
  }

  const messages =
    normalizeMessages(
      (
        body as {
          messages?: unknown
        }
      )?.messages,
    )

  if (!messages) {
    return fail(
      "HistÃ³rico de mensagens invÃ¡lido.",
      400,
    )
  }

  try {
    const result =
      await generateGeminiText({
        systemInstruction:
          SABORFLOW_AI_SYSTEM_PROMPT,
        messages,
      })

    return NextResponse.json(
      {
        ok: true,
        reply: result.text,
        model: result.model,
        usage: result.usage,
        organizationId:
          session.organizationId,
      },
      { headers: headers() },
    )
  } catch (error) {
    console.error(
      "Falha no chat IA:",
      error instanceof Error
        ? error.message
        : error,
    )

    return fail(
      "A IA estÃ¡ temporariamente indisponÃ­vel.",
      502,
    )
  }
}
