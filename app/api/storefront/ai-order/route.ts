import {
  NextResponse,
} from "next/server"

import {
  generateGeminiOrderJson,
} from "@/lib/ai/gemini-order"

export const dynamic =
  "force-dynamic"

export const runtime =
  "nodejs"

const MAX_AUDIO_BYTES =
  8 * 1024 * 1024

const MAX_PRODUCTS =
  250

const MAX_TEXT_LENGTH =
  1200

type CatalogItem = {
  id: number
  name: string
  description: string
  available: boolean
  hasModifiers: boolean
}

type AiItem = {
  productId: number
  quantity: number
  note: string
  requiresCustomization: boolean
}

type RateEntry = {
  count: number
  resetAt: number
}

const rateGlobal =
  globalThis as typeof globalThis & {
    __saborflowAiOrderRate?: Map<
      string,
      RateEntry
    >
  }

const rateStore =
  rateGlobal.__saborflowAiOrderRate ||
  new Map<string, RateEntry>()

rateGlobal.__saborflowAiOrderRate =
  rateStore

function checkRate(
  request: Request,
) {
  const ip =
    request.headers.get(
      "cf-connecting-ip",
    ) ||
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    "unknown"

  const now =
    Date.now()

  const current =
    rateStore.get(ip)

  if (
    !current ||
    now >
      current.resetAt
  ) {
    rateStore.set(ip, {
      count: 1,
      resetAt:
        now + 5 * 60_000,
    })

    return true
  }

  if (
    current.count >= 12
  ) {
    return false
  }

  current.count += 1
  rateStore.set(ip, current)

  return true
}

function cleanCatalog(
  value: unknown,
): CatalogItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const items: CatalogItem[] = []

  for (
    const raw of value.slice(
      0,
      MAX_PRODUCTS,
    )
  ) {
    if (
      !raw ||
      typeof raw !== "object"
    ) {
      continue
    }

    const item =
      raw as Record<
        string,
        unknown
      >

    const id =
      Number(item.id)

    const name =
      typeof item.name ===
      "string"
        ? item.name
            .trim()
            .slice(0, 120)
        : ""

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !name
    ) {
      continue
    }

    items.push({
      id,
      name,
      description:
        typeof item.description ===
        "string"
          ? item.description
              .trim()
              .slice(0, 180)
          : "",
      available:
        item.available !== false,
      hasModifiers:
        item.hasModifiers === true,
    })
  }

  return items
}

function extractJson(
  value: string,
) {
  let text =
    value.trim()

  text =
    text.replace(
      /^```(?:json)?/i,
      "",
    )

  text =
    text.replace(
      /```$/i,
      "",
    )

  text =
    text.trim()

  const first =
    text.indexOf("{")

  const last =
    text.lastIndexOf("}")

  if (
    first >= 0 &&
    last > first
  ) {
    text =
      text.slice(
        first,
        last + 1,
      )
  }

  return text
}

function normalizeResult(
  raw: string,
  catalog: CatalogItem[],
  fallbackTranscript: string,
) {
  const parsed =
    JSON.parse(
      extractJson(raw),
    ) as {
      transcript?: unknown
      message?: unknown
      items?: unknown
      unresolved?: unknown
    }

  const allowed =
    new Map(
      catalog.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    )

  const merged =
    new Map<
      number,
      AiItem
    >()

  if (
    Array.isArray(
      parsed.items,
    )
  ) {
    for (
      const rawItem of
        parsed.items
    ) {
      if (
        !rawItem ||
        typeof rawItem !==
          "object"
      ) {
        continue
      }

      const item =
        rawItem as Record<
          string,
          unknown
        >

      const productId =
        Number(
          item.productId,
        )

      const catalogItem =
        allowed.get(
          productId,
        )

      if (
        !catalogItem ||
        !catalogItem.available
      ) {
        continue
      }

      const quantity =
        Math.min(
          999,
          Math.max(
            1,
            Math.floor(
              Number(
                item.quantity,
              ) || 1,
            ),
          ),
        )

      const note =
        typeof item.note ===
        "string"
          ? item.note
              .trim()
              .slice(0, 240)
          : ""

      const existing =
        merged.get(
          productId,
        )

      if (existing) {
        existing.quantity =
          Math.min(
            999,
            existing.quantity +
              quantity,
          )

        if (
          note &&
          !existing.note
        ) {
          existing.note =
            note
        }

        continue
      }

      merged.set(
        productId,
        {
          productId,
          quantity,
          note,
          requiresCustomization:
            catalogItem
              .hasModifiers,
        },
      )
    }
  }

  const unresolved =
    Array.isArray(
      parsed.unresolved,
    )
      ? parsed.unresolved
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
              "string",
          )
          .map(
            (value) =>
              value
                .trim()
                .slice(0, 180),
          )
          .filter(Boolean)
          .slice(0, 8)
      : []

  return {
    transcript:
      typeof parsed.transcript ===
      "string"
        ? parsed.transcript
            .trim()
            .slice(
              0,
              MAX_TEXT_LENGTH,
            )
        : fallbackTranscript,
    message:
      typeof parsed.message ===
      "string"
        ? parsed.message
            .trim()
            .slice(0, 500)
        : "",
    items:
      [...merged.values()],
    unresolved,
  }
}

function systemInstruction() {
  return `
VocÃª Ã© o interpretador de pedidos do SaborFlow.

Sua tarefa Ã© transformar o pedido do cliente em itens do cardÃ¡pio fornecido.

REGRAS OBRIGATÃ“RIAS:

1. Nunca invente produto.
2. Nunca invente productId.
3. Use somente IDs presentes no CATÃLOGO.
4. Ignore preÃ§os. O SaborFlow calcula preÃ§os.
5. NÃ£o crie descontos.
6. NÃ£o substitua um produto por outro sem certeza.
7. Se houver dÃºvida, coloque a dÃºvida em "unresolved".
8. Produto indisponÃ­vel nÃ£o deve entrar em "items".
9. "um cento" = 100.
10. "meio cento" = 50.
11. "uma dÃºzia" = 12.
12. "duas dÃºzias" = 24.
13. Quantidades devem ser nÃºmeros inteiros positivos.
14. Produtos que possuem adicionais/opÃ§Ãµes podem ser identificados, mas serÃ£o personalizados posteriormente pelo SaborFlow.
15. Para Ã¡udio, transcreva o que foi entendido em "transcript".
16. Responda SOMENTE JSON vÃ¡lido, sem markdown.

Formato obrigatÃ³rio:

{
  "transcript": "texto entendido",
  "message": "resumo curto para o cliente",
  "items": [
    {
      "productId": 123,
      "quantity": 2,
      "note": ""
    }
  ],
  "unresolved": []
}
`.trim()
}

export async function POST(
  request: Request,
) {
  if (!checkRate(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Muitas solicitaÃ§Ãµes. Aguarde alguns minutos.",
      },
      {
        status: 429,
      },
    )
  }

  try {
    const contentType =
      request.headers
        .get("content-type") ||
      ""

    let message = ""
    let catalog: CatalogItem[] = []
    let audio:
      | {
          mimeType: string
          bytes: Uint8Array
        }
      | undefined

    if (
      contentType.includes(
        "multipart/form-data",
      )
    ) {
      const form =
        await request.formData()

      const rawCatalog =
        form.get("catalog")

      const rawMessage =
        form.get("message")

      const audioFile =
        form.get("audio")

      if (
        typeof rawCatalog !==
        "string"
      ) {
        throw new Error(
          "CatÃ¡logo invÃ¡lido.",
        )
      }

      catalog =
        cleanCatalog(
          JSON.parse(
            rawCatalog,
          ),
        )

      message =
        typeof rawMessage ===
        "string"
          ? rawMessage
              .trim()
              .slice(
                0,
                MAX_TEXT_LENGTH,
              )
          : ""

      if (
        !(audioFile instanceof File)
      ) {
        throw new Error(
          "Ãudio nÃ£o recebido.",
        )
      }

      if (
        audioFile.size <= 0 ||
        audioFile.size >
          MAX_AUDIO_BYTES
      ) {
        throw new Error(
          "O Ã¡udio deve ter no mÃ¡ximo 8 MB.",
        )
      }

      const mimeType =
        (
          audioFile.type ||
          "audio/webm"
        )
          .split(";")[0]
          .trim()
          .toLowerCase()

      const allowedAudio =
        new Set([
          "audio/webm",
          "audio/ogg",
          "audio/mp4",
          "audio/mpeg",
          "audio/wav",
          "audio/x-wav",
        ])

      if (
        !allowedAudio.has(
          mimeType,
        )
      ) {
        throw new Error(
          "Formato de Ã¡udio nÃ£o suportado.",
        )
      }

      audio = {
        mimeType,
        bytes:
          new Uint8Array(
            await audioFile.arrayBuffer(),
          ),
      }
    } else {
      const body =
        (await request.json()) as {
          message?: unknown
          catalog?: unknown
        }

      message =
        typeof body.message ===
        "string"
          ? body.message
              .trim()
              .slice(
                0,
                MAX_TEXT_LENGTH,
              )
          : ""

      catalog =
        cleanCatalog(
          body.catalog,
        )
    }

    if (!catalog.length) {
      throw new Error(
        "Nenhum produto disponÃ­vel para interpretaÃ§Ã£o.",
      )
    }

    if (
      !audio &&
      !message
    ) {
      throw new Error(
        "Digite ou grave seu pedido.",
      )
    }

    const catalogJson =
      JSON.stringify(
        catalog,
      )

    const instruction =
      audio
        ? `
OuÃ§a o Ã¡udio do cliente e interprete o pedido.

Caso exista texto digitado junto do Ã¡udio, use como contexto:
${message || "(nenhum)"}

CATÃLOGO:
${catalogJson}
`.trim()
        : `
Interprete este pedido:

"${message}"

CATÃLOGO:
${catalogJson}
`.trim()

    const generated =
      await generateGeminiOrderJson(
        {
          systemInstruction:
            systemInstruction(),
          instruction,
          audio,
        },
      )

    const result =
      normalizeResult(
        generated.text,
        catalog,
        message,
      )

    return NextResponse.json({
      ok: true,
      ...result,
      model:
        generated.model,
    })
  } catch (error) {
    console.error(
      "Falha no pedido inteligente.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "NÃ£o foi possÃ­vel interpretar o pedido.",
      },
      {
        status: 400,
      },
    )
  }
}