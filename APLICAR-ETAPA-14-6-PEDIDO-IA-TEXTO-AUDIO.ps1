$ErrorActionPreference = "Stop"

$utf8 = New-Object System.Text.UTF8Encoding($false)

$storePath = "components\store\storefront.tsx"
$componentPath = "components\store\ai-order-assistant.tsx"
$routePath = "app\api\storefront\ai-order\route.ts"
$geminiOrderPath = "lib\ai\gemini-order.ts"

New-Item -ItemType Directory -Force "app\api\storefront\ai-order" | Out-Null
New-Item -ItemType Directory -Force "components\store" | Out-Null
New-Item -ItemType Directory -Force "lib\ai" | Out-Null

Copy-Item $storePath "$storePath.bak146" -Force

# ============================================================
# GEMINI - TEXTO + AUDIO
# ============================================================

$geminiOrder = @'
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
      "GEMINI_API_KEY não foi configurada.",
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
        "A IA não retornou uma interpretação do pedido.",
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
'@

[System.IO.File]::WriteAllText(
  $geminiOrderPath,
  $geminiOrder,
  $utf8
)

# ============================================================
# API PUBLICA DO PEDIDO IA
# ============================================================

$route = @'
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
Você é o interpretador de pedidos do SaborFlow.

Sua tarefa é transformar o pedido do cliente em itens do cardápio fornecido.

REGRAS OBRIGATÓRIAS:

1. Nunca invente produto.
2. Nunca invente productId.
3. Use somente IDs presentes no CATÁLOGO.
4. Ignore preços. O SaborFlow calcula preços.
5. Não crie descontos.
6. Não substitua um produto por outro sem certeza.
7. Se houver dúvida, coloque a dúvida em "unresolved".
8. Produto indisponível não deve entrar em "items".
9. "um cento" = 100.
10. "meio cento" = 50.
11. "uma dúzia" = 12.
12. "duas dúzias" = 24.
13. Quantidades devem ser números inteiros positivos.
14. Produtos que possuem adicionais/opções podem ser identificados, mas serão personalizados posteriormente pelo SaborFlow.
15. Para áudio, transcreva o que foi entendido em "transcript".
16. Responda SOMENTE JSON válido, sem markdown.

Formato obrigatório:

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
          "Muitas solicitações. Aguarde alguns minutos.",
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
          "Catálogo inválido.",
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
          "Áudio não recebido.",
        )
      }

      if (
        audioFile.size <= 0 ||
        audioFile.size >
          MAX_AUDIO_BYTES
      ) {
        throw new Error(
          "O áudio deve ter no máximo 8 MB.",
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
          "Formato de áudio não suportado.",
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
        "Nenhum produto disponível para interpretação.",
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
Ouça o áudio do cliente e interprete o pedido.

Caso exista texto digitado junto do áudio, use como contexto:
${message || "(nenhum)"}

CATÁLOGO:
${catalogJson}
`.trim()
        : `
Interprete este pedido:

"${message}"

CATÁLOGO:
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
            : "Não foi possível interpretar o pedido.",
      },
      {
        status: 400,
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

# ============================================================
# COMPONENTE DE TEXTO + AUDIO
# ============================================================

$component = @'
"use client"

import {
  FormEvent,
  useRef,
  useState,
} from "react"

import {
  Loader2,
  Mic,
  Send,
  Sparkles,
  Square,
} from "lucide-react"

import {
  productHasModifiers,
} from "@/lib/product-composition"

import type {
  Product,
} from "@/lib/types"

export type AiOrderItem = {
  productId: number
  quantity: number
  note: string
  requiresCustomization: boolean
}

type AiResult = {
  transcript: string
  message: string
  items: AiOrderItem[]
  unresolved: string[]
}

export function AiOrderAssistant({
  products,
  primaryColor,
  storeName,
  onApply,
}: {
  products: Product[]
  primaryColor: string
  storeName: string
  onApply: (
    items: AiOrderItem[],
  ) => void
}) {
  const [text, setText] =
    useState("")

  const [busy, setBusy] =
    useState(false)

  const [
    recording,
    setRecording,
  ] = useState(false)

  const [error, setError] =
    useState("")

  const [result, setResult] =
    useState<AiResult | null>(
      null,
    )

  const recorderRef =
    useRef<MediaRecorder | null>(
      null,
    )

  const chunksRef =
    useRef<Blob[]>([])

  const timerRef =
    useRef<number | null>(
      null,
    )

  function catalog() {
    return products.map(
      (product) => ({
        id: product.id,
        name: product.name,
        description:
          product.description || "",
        available:
          !(
            (
              product.trackStock &&
              product.stock <= 0
            ) ||
            product
              .ingredientStockAvailable ===
              false
          ),
        hasModifiers:
          productHasModifiers(
            product,
          ),
      }),
    )
  }

  async function send(
    audio?: Blob,
  ) {
    if (
      !audio &&
      !text.trim()
    ) {
      setError(
        "Digite ou grave seu pedido.",
      )
      return
    }

    setBusy(true)
    setError("")
    setResult(null)

    try {
      let response: Response

      if (audio) {
        const form =
          new FormData()

        const mime =
          audio.type ||
          "audio/webm"

        const extension =
          mime.includes("mp4")
            ? "m4a"
            : mime.includes("ogg")
              ? "ogg"
              : "webm"

        form.append(
          "audio",
          new File(
            [audio],
            `pedido.${extension}`,
            {
              type: mime,
            },
          ),
        )

        form.append(
          "catalog",
          JSON.stringify(
            catalog(),
          ),
        )

        form.append(
          "message",
          text.trim(),
        )

        response =
          await fetch(
            "/api/storefront/ai-order",
            {
              method: "POST",
              body: form,
            },
          )
      } else {
        response =
          await fetch(
            "/api/storefront/ai-order",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                message:
                  text.trim(),
                catalog:
                  catalog(),
              }),
            },
          )
      }

      const payload =
        (await response.json()) as {
          ok?: boolean
          error?: string
          transcript?: string
          message?: string
          items?: AiOrderItem[]
          unresolved?: string[]
        }

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.error ||
            "Não foi possível interpretar o pedido.",
        )
      }

      const next: AiResult = {
        transcript:
          payload.transcript ||
          text.trim(),
        message:
          payload.message ||
          "",
        items:
          payload.items || [],
        unresolved:
          payload.unresolved ||
          [],
      }

      setResult(next)

      if (
        audio &&
        next.transcript
      ) {
        setText(
          next.transcript,
        )
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao interpretar pedido.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function toggleRecording() {
    if (recording) {
      const recorder =
        recorderRef.current

      if (
        recorder &&
        recorder.state ===
          "recording"
      ) {
        recorder.stop()
      }

      return
    }

    setError("")
    setResult(null)

    if (
      !navigator.mediaDevices
        ?.getUserMedia ||
      typeof MediaRecorder ===
        "undefined"
    ) {
      setError(
        "Seu navegador não suporta gravação de áudio.",
      )
      return
    }

    try {
      const stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: true,
          })

      const preferred =
        [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
        ].find(
          (value) =>
            MediaRecorder
              .isTypeSupported(
                value,
              ),
        )

      const recorder =
        new MediaRecorder(
          stream,
          preferred
            ? {
                mimeType:
                  preferred,
              }
            : undefined,
        )

      recorderRef.current =
        recorder

      chunksRef.current = []

      recorder.ondataavailable =
        (event) => {
          if (
            event.data.size > 0
          ) {
            chunksRef.current.push(
              event.data,
            )
          }
        }

      recorder.onstop =
        () => {
          if (
            timerRef.current
          ) {
            window.clearTimeout(
              timerRef.current,
            )

            timerRef.current =
              null
          }

          setRecording(false)

          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop(),
            )

          const blob =
            new Blob(
              chunksRef.current,
              {
                type:
                  recorder.mimeType ||
                  preferred ||
                  "audio/webm",
              },
            )

          if (blob.size > 0) {
            void send(blob)
          }
        }

      recorder.start()

      setRecording(true)

      timerRef.current =
        window.setTimeout(
          () => {
            if (
              recorder.state ===
              "recording"
            ) {
              recorder.stop()
            }
          },
          30_000,
        )
    } catch {
      setError(
        "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
      )
    }
  }

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault()
    void send()
  }

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{
              backgroundColor:
                primaryColor,
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">
              Pedido inteligente
            </p>

            <h2 className="mt-1 text-xl font-black text-gray-950">
              Peça por texto ou áudio
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500">
              Diga o que deseja e o
              SaborFlow encontra os
              produtos de {storeName}.
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="mt-5 flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(event) =>
              setText(
                event.target.value,
              )
            }
            maxLength={1200}
            placeholder="Ex.: Quero 3 coxinhas e uma Coca 2L"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void toggleRecording()
            }
            aria-label={
              recording
                ? "Parar gravação"
                : "Gravar pedido"
            }
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm transition ${
              recording
                ? "animate-pulse bg-red-500"
                : "bg-gray-950"
            }`}
          >
            {recording ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>

          <button
            type="submit"
            disabled={
              busy ||
              recording ||
              !text.trim()
            }
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor:
                primaryColor,
            }}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>

        {recording && (
          <p className="mt-3 text-xs font-bold text-red-600">
            Gravando... toque novamente
            no microfone para enviar.
            Máximo de 30 segundos.
          </p>
        )}

        {busy && (
          <p className="mt-3 text-xs font-bold text-gray-500">
            Entendendo seu pedido...
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-gray-950">
              {result.message ||
                "Entendi seu pedido:"}
            </p>

            {result.items.length >
              0 && (
              <div className="mt-3 space-y-2">
                {result.items.map(
                  (item) => {
                    const product =
                      products.find(
                        (
                          current,
                        ) =>
                          current.id ===
                          item.productId,
                      )

                    if (
                      !product
                    ) {
                      return null
                    }

                    return (
                      <div
                        key={
                          item.productId
                        }
                        className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5"
                      >
                        <div>
                          <strong className="text-sm text-gray-900">
                            {
                              item.quantity
                            }
                            ×{" "}
                            {
                              product.name
                            }
                          </strong>

                          {item.note && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {
                                item.note
                              }
                            </p>
                          )}
                        </div>

                        {item.requiresCustomization && (
                          <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700">
                            Configurar
                          </span>
                        )}
                      </div>
                    )
                  },
                )}
              </div>
            )}

            {result.unresolved.length >
              0 && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3">
                <p className="text-xs font-black text-amber-800">
                  Preciso confirmar:
                </p>

                <ul className="mt-1 space-y-1 text-xs text-amber-700">
                  {result.unresolved.map(
                    (
                      item,
                      index,
                    ) => (
                      <li
                        key={index}
                      >
                        • {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}

            {result.items.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  onApply(
                    result.items,
                  )
                }
                className="mt-4 h-11 w-full rounded-xl text-sm font-black text-white"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                Adicionar ao carrinho
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
'@

[System.IO.File]::WriteAllText(
  $componentPath,
  $component,
  $utf8
)

# ============================================================
# INTEGRAR NO STOREFRONT
# ============================================================

$store =
  [System.IO.File]::ReadAllText(
    $storePath
  )

$importAnchor =
  'import { StoreChatbot } from "@/components/store/store-chatbot"'

$importNew = @'
import { StoreChatbot } from "@/components/store/store-chatbot"
import {
  AiOrderAssistant,
  type AiOrderItem,
} from "@/components/store/ai-order-assistant"
'@

if (
  $store -notmatch
    'AiOrderAssistant'
) {
  if (
    -not $store.Contains(
      $importAnchor
    )
  ) {
    throw "Import StoreChatbot não encontrado."
  }

  $store =
    $store.Replace(
      $importAnchor,
      $importNew
    )
}

$functionAnchor =
  '  function setCartItemQuantity(key: string, quantity: number) {'

$aiFunction = @'
  function applyAiOrderItems(
    items: AiOrderItem[],
  ) {
    const notes: string[] = []

    let firstProductToCustomize:
      Product | null = null

    for (const item of items) {
      const product =
        products.find(
          (current) =>
            current.id ===
            item.productId,
        )

      if (!product) {
        continue
      }

      const unavailable =
        (
          product.trackStock &&
          product.stock <= 0
        ) ||
        product
          .ingredientStockAvailable ===
          false

      if (unavailable) {
        continue
      }

      if (
        productHasModifiers(
          product,
        )
      ) {
        if (
          !firstProductToCustomize
        ) {
          firstProductToCustomize =
            product
        }

        continue
      }

      setSimpleProductQuantity(
        product,
        totalProductQuantity(
          product.id,
        ) + item.quantity,
      )

      if (item.note) {
        notes.push(
          `${product.name}: ${item.note}`,
        )
      }
    }

    if (notes.length) {
      setCheckout(
        (current) => ({
          ...current,
          notes: [
            current.notes,
            ...notes,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      )
    }

    if (
      firstProductToCustomize
    ) {
      setCustomizingProduct(
        firstProductToCustomize,
      )
    } else {
      setCartOpen(true)
    }
  }

  function setCartItemQuantity(key: string, quantity: number) {
'@

if (
  $store -notmatch
    'function applyAiOrderItems'
) {
  if (
    -not $store.Contains(
      $functionAnchor
    )
  ) {
    throw "setCartItemQuantity não encontrada."
  }

  $store =
    $store.Replace(
      $functionAnchor,
      $aiFunction
    )
}

$renderAnchor =
  '        {lastOrder && !["completed", "cancelled"].includes(lastOrder.status)'

$renderNew = @'
        {pageMode === "order" && (
          <AiOrderAssistant
            products={products}
            primaryColor={settings.primaryColor}
            storeName={settings.storeName}
            onApply={applyAiOrderItems}
          />
        )}

        {lastOrder && !["completed", "cancelled"].includes(lastOrder.status)
'@

if (
  $store -notmatch
    '<AiOrderAssistant'
) {
  if (
    -not $store.Contains(
      $renderAnchor
    )
  ) {
    throw "Ponto de renderização não encontrado."
  }

  $store =
    $store.Replace(
      $renderAnchor,
      $renderNew
    )
}

[System.IO.File]::WriteAllText(
  $storePath,
  $store,
  $utf8
)

Write-Host ""
Write-Host "ETAPA 14.6 aplicada." -ForegroundColor Green
Write-Host "Pedido por texto + áudio integrado ao carrinho." -ForegroundColor Green