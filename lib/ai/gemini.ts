export type GeminiChatMessage = {
  role: "user" | "model"
  text: string
}

export type GeminiTextResult = {
  text: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  error?: {
    message?: string
  }
}

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models"

function apiKey() {
  const value =
    process.env.GEMINI_API_KEY?.trim()

  if (!value) {
    throw new Error(
      "GEMINI_API_KEY nÃ£o foi configurado.",
    )
  }

  return value
}

export function configuredGeminiModel() {
  return (
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-3.5-flash-lite"
  )
}

function count(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0
    ? Math.floor(n)
    : 0
}

export async function generateGeminiText(
  input: {
    systemInstruction: string
    messages: GeminiChatMessage[]
  },
): Promise<GeminiTextResult> {
  const model = configuredGeminiModel()
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    30_000,
  )

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey(),
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              { text: input.systemInstruction },
            ],
          },
          contents: input.messages.map(
            (message) => ({
              role: message.role,
              parts: [
                { text: message.text },
              ],
            }),
          ),
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 900,
          },
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    )

    const payload =
      (await response
        .json()
        .catch(() => ({}))) as GeminiApiResponse

    if (!response.ok) {
      const detail =
        payload.error?.message
          ?.replace(/\s+/g, " ")
          .trim()
          .slice(0, 300)

      throw new Error(
        detail
          ? `Gemini HTTP ${response.status}: ${detail}`
          : `Gemini HTTP ${response.status}.`,
      )
    }

    const text =
      payload.candidates
        ?.flatMap(
          (candidate) =>
            candidate.content?.parts || [],
        )
        .map((part) => part.text || "")
        .join("")
        .trim() || ""

    if (!text) {
      throw new Error(
        "A IA nÃ£o retornou texto.",
      )
    }

    const usage =
      payload.usageMetadata || {}

    return {
      text,
      model,
      usage: {
        inputTokens: count(
          usage.promptTokenCount,
        ),
        outputTokens: count(
          usage.candidatesTokenCount,
        ),
        totalTokens: count(
          usage.totalTokenCount,
        ),
      },
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Tempo limite da IA excedido.",
      )
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}
