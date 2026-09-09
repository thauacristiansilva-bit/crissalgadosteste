import {
  configuredGeminiModel,
} from "@/lib/ai/gemini"

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
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
      "GEMINI_API_KEY nÃ£o foi configurada.",
    )
  }

  return value
}

export async function generateGeminiOrderJson(
  input: {
    systemInstruction: string
    instruction: string
    audio?: {
      mimeType: string
      bytes: Uint8Array
    }
  },
) {
  const model =
    input.audio
      ? (
          process.env.GEMINI_AUDIO_MODEL?.trim() ||
          configuredGeminiModel()
        )
      : configuredGeminiModel()

  const parts: Array<
    | { text: string }
    | {
        inlineData: {
          mimeType: string
          data: string
        }
      }
  > = [
    {
      text: input.instruction,
    },
  ]

  if (input.audio) {
    parts.push({
      inlineData: {
        mimeType:
          input.audio.mimeType,
        data:
          Buffer.from(
            input.audio.bytes,
          ).toString("base64"),
      },
    })
  }

  const controller =
    new AbortController()

  const timer =
    setTimeout(
      () => controller.abort(),
      30_000,
    )

  try {
    const response =
      await fetch(
        `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "x-goog-api-key":
              apiKey(),
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    input.systemInstruction,
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts,
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 700,
            },
          }),
          cache: "no-store",
          signal:
            controller.signal,
        },
      )

    const payload =
      (await response
        .json()
        .catch(
          () => ({}),
        )) as GeminiResponse

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
            candidate.content
              ?.parts || [],
        )
        .map(
          (part) =>
            part.text || "",
        )
        .join("")
        .trim() || ""

    if (!text) {
      throw new Error(
        "A IA nÃ£o retornou uma interpretaÃ§Ã£o do pedido.",
      )
    }

    return {
      text,
      model,
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
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