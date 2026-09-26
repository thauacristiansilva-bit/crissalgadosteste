const fs = require("fs")

const AI_FILE = "components/store/ai-order-assistant.tsx"
const CHATBOT_FILE = "components/store/store-chatbot.tsx"
const STOREFRONT_FILE = "components/store/storefront.tsx"

for (const file of [AI_FILE, CHATBOT_FILE, STOREFRONT_FILE]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${file}`)
  }
  fs.copyFileSync(file, `${file}.bak1472`)
}

const aiOrderAssistant = `"use client"

import type {
  FormEvent,
} from "react"

import {
  useEffect,
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

type Props = {
  products: Product[]
  primaryColor: string
  storeName: string
  onApply: (
    items: AiOrderItem[],
  ) => void
  textEnabled?: boolean
  audioEnabled?: boolean
  variant?: "card" | "chat"
}

export function AiOrderAssistant({
  products,
  primaryColor,
  storeName,
  onApply,
  textEnabled = true,
  audioEnabled = true,
  variant = "card",
}: Props) {
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

  const streamRef =
    useRef<MediaStream | null>(
      null,
    )

  const chunksRef =
    useRef<Blob[]>([])

  const timerRef =
    useRef<number | null>(
      null,
    )

  useEffect(() => {
    return () => {
      if (
        timerRef.current !== null
      ) {
        window.clearTimeout(
          timerRef.current,
        )
        timerRef.current = null
      }

      const recorder =
        recorderRef.current

      if (recorder) {
        recorder.ondataavailable =
          null
        recorder.onstop = null

        if (
          recorder.state ===
          "recording"
        ) {
          try {
            recorder.stop()
          } catch {}
        }
      }

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        )

      streamRef.current = null
    }
  }, [])

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
      (
        !textEnabled ||
        !text.trim()
      )
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
            "pedido." + extension,
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
          textEnabled
            ? text.trim()
            : "",
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
            "Nao foi possivel interpretar o pedido.",
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
        textEnabled &&
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
    if (!audioEnabled) {
      return
    }

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
        "Seu navegador nao suporta gravacao de audio.",
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

      streamRef.current =
        stream

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
            timerRef.current !==
            null
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

          streamRef.current =
            null

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
      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        )

      streamRef.current = null

      setError(
        "Nao foi possivel acessar o microfone. Verifique a permissao do navegador.",
      )
    }
  }

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault()

    if (!textEnabled) {
      return
    }

    void send()
  }

  function applyResult() {
    if (!result?.items.length) {
      return
    }

    onApply(result.items)
    setResult(null)
    setText("")
    setError("")
  }

  if (
    !textEnabled &&
    !audioEnabled
  ) {
    return null
  }

  const compact =
    variant === "chat"

  return (
    <section
      className={
        compact
          ? "mt-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-3"
          : "mt-4 overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white shadow-sm"
      }
    >
      <div
        className={
          compact
            ? ""
            : "p-5 sm:p-6"
        }
      >
        {compact ? (
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-violet-700">
              <Sparkles className="h-4 w-4" />
              Pedido por IA
            </div>

            <p className="mt-1 text-[11px] leading-5 text-gray-500">
              Escreva ou fale o que deseja pedir em {storeName}.
            </p>
          </div>
        ) : (
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
                Peca por texto ou audio
              </h2>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Diga o que deseja e o SaborFlow encontra os produtos de {storeName}.
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={submit}
          className={
            compact
              ? "mt-3 flex items-center gap-2"
              : "mt-5 flex items-center gap-2"
          }
        >
          {textEnabled && (
            <input
              value={text}
              onChange={(event) =>
                setText(
                  event.target.value,
                )
              }
              disabled={busy || recording}
              maxLength={1200}
              placeholder="Ex.: 3 coxinhas e uma Coca 2L"
              className={
                compact
                  ? "h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
                  : "h-12 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
              }
            />
          )}

          {audioEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void toggleRecording()
              }
              aria-label={
                recording
                  ? "Parar gravacao"
                  : "Gravar pedido"
              }
              className={
                (
                  compact
                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition "
                    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm transition "
                ) +
                (
                  recording
                    ? "animate-pulse bg-red-500"
                    : "bg-gray-950"
                )
              }
            >
              {recording ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          )}

          {textEnabled && (
            <button
              type="submit"
              disabled={
                busy ||
                recording ||
                !text.trim()
              }
              aria-label="Enviar pedido"
              className={
                compact
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                  : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              }
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
          )}
        </form>

        {!textEnabled &&
          audioEnabled && (
            <p className="mt-2 text-center text-[11px] font-semibold text-gray-500">
              Toque no microfone e fale seu pedido.
            </p>
          )}

        {recording && (
          <p className="mt-3 text-xs font-bold text-red-600">
            Gravando... toque novamente no microfone para enviar. Maximo de 30 segundos.
          </p>
        )}

        {busy && (
          <p className="mt-3 text-xs font-bold text-gray-500">
            Entendendo seu pedido...
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-black text-gray-950">
              {result.message ||
                "Entendi seu pedido:"}
            </p>

            {result.items.length >
              0 && (
              <div className="mt-2 space-y-2">
                {result.items.map(
                  (item) => {
                    const product =
                      products.find(
                        (current) =>
                          current.id ===
                          item.productId,
                      )

                    if (!product) {
                      return null
                    }

                    return (
                      <div
                        key={
                          item.productId
                        }
                        className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate text-xs text-gray-900">
                            {item.quantity}
                            {" x "}
                            {product.name}
                          </strong>

                          {item.note && (
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {item.note}
                            </p>
                          )}
                        </div>

                        {item.requiresCustomization && (
                          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[9px] font-black text-orange-700">
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
              <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2">
                <p className="text-[11px] font-black text-amber-800">
                  Preciso confirmar:
                </p>

                <ul className="mt-1 space-y-1 text-[11px] text-amber-700">
                  {result.unresolved.map(
                    (
                      item,
                      index,
                    ) => (
                      <li key={index}>
                        {"- "}{item}
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
                onClick={applyResult}
                className="mt-3 h-10 w-full rounded-xl text-xs font-black text-white"
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
`

const storeChatbot = `"use client"

import {
  useState,
} from "react"

import {
  Bot,
  Clock3,
  CreditCard,
  MessageCircle,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react"

import {
  AiOrderAssistant,
  type AiOrderItem,
} from "@/components/store/ai-order-assistant"

import type {
  Product,
  StoreSettings,
} from "@/lib/types"

export function StoreChatbot({
  settings,
  products,
  onApplyOrder,
}: {
  settings: StoreSettings
  products: Product[]
  onApplyOrder: (
    items: AiOrderItem[],
  ) => void
}) {
  const [open, setOpen] =
    useState(false)

  const [answer, setAnswer] =
    useState(
      settings.chatbotGreeting,
    )

  if (
    !settings.chatbotEnabled ||
    settings.aiStorefrontChatEnabled ===
      false ||
    settings.aiFloatingButtonEnabled ===
      false
  ) {
    return null
  }

  const textEnabled =
    settings.aiStorefrontTextEnabled !==
    false

  const audioEnabled =
    settings.aiStorefrontAudioEnabled !==
    false

  const orderAssistantEnabled =
    textEnabled ||
    audioEnabled

  const payments = [
    settings.pixEnabled &&
      "PIX",
    settings.cashEnabled &&
      "Dinheiro",
    settings.cardEnabled &&
      "Cartao",
  ]
    .filter(Boolean)
    .join(", ")

  const whatsappDigits =
    settings.whatsapp
      .replace(/\\D/g, "")

  const whatsappUrl =
    "https://wa.me/" +
    whatsappDigits

  function applyOrder(
    items: AiOrderItem[],
  ) {
    onApplyOrder(items)
    setOpen(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90]">
      {open && (
        <div className="mb-3 flex max-h-[min(78vh,680px)] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-slate-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Bot className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <strong className="block truncate text-sm">
                  Assistente de {settings.storeName}
                </strong>

                <span className="text-[10px] text-white/60">
                  Atendimento e pedidos
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              aria-label="Fechar assistente"
              className="rounded-lg p-2 transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            <div className="rounded-2xl rounded-tl-sm bg-gray-100 p-3 text-sm leading-relaxed text-gray-700">
              {answer}
            </div>

            {orderAssistantEnabled && (
              <AiOrderAssistant
                products={products}
                primaryColor={
                  settings.primaryColor
                }
                storeName={
                  settings.storeName
                }
                textEnabled={
                  textEnabled
                }
                audioEnabled={
                  audioEnabled
                }
                variant="chat"
                onApply={
                  applyOrder
                }
              />
            )}

            {!orderAssistantEnabled && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                <ShoppingBag className="h-4 w-4" />
                Pedidos por IA estao desativados nesta loja.
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    "Nosso horario: " +
                      settings.openingHours,
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"
              >
                <Clock3 className="h-4 w-4" />
                Horario
              </button>

              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    "Delivery: prazo aproximado de " +
                      settings.deliveryMinMinutes +
                      " a " +
                      settings.deliveryMaxMinutes +
                      " min. Marque seu ponto exato no mapa para calcular a area.",
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"
              >
                <Truck className="h-4 w-4" />
                Entrega
              </button>

              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    "Pagamentos disponiveis: " +
                      (
                        payments ||
                        "consulte a loja"
                      ) +
                      ".",
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"
              >
                <CreditCard className="h-4 w-4" />
                Pagamento
              </button>

              {whatsappDigits ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-400">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) =>
              !value,
          )
        }
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl transition hover:scale-105"
        aria-label={
          open
            ? "Fechar assistente"
            : "Abrir assistente"
        }
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </button>
    </div>
  )
}
`

fs.writeFileSync(
  AI_FILE,
  aiOrderAssistant,
  "utf8",
)

fs.writeFileSync(
  CHATBOT_FILE,
  storeChatbot,
  "utf8",
)

let storefront =
  fs.readFileSync(
    STOREFRONT_FILE,
    "utf8",
  )

const oldImport = `import { StoreChatbot } from "@/components/store/store-chatbot"
import {
  AiOrderAssistant,
  type AiOrderItem,
} from "@/components/store/ai-order-assistant"`

const newImport = `import { StoreChatbot } from "@/components/store/store-chatbot"
import type { AiOrderItem } from "@/components/store/ai-order-assistant"`

if (
  storefront.includes(
    oldImport,
  )
) {
  storefront =
    storefront.replace(
      oldImport,
      newImport,
    )
} else {
  storefront =
    storefront.replace(
      /import\s*\{\s*AiOrderAssistant,\s*type\s+AiOrderItem,\s*\}\s*from\s*"@\/components\/store\/ai-order-assistant"/,
      'import type { AiOrderItem } from "@/components/store/ai-order-assistant"',
    )
}

const aiBlock =
  /\s*\{pageMode === "order" && \(\s*<AiOrderAssistant\s+products=\{products\}\s+primaryColor=\{settings\.primaryColor\}\s+storeName=\{settings\.storeName\}\s+onApply=\{applyAiOrderItems\}\s*\/>\s*\)\}\s*/

if (
  aiBlock.test(
    storefront,
  )
) {
  storefront =
    storefront.replace(
      aiBlock,
      "\n\n",
    )
}

const oldChatbot =
  '<StoreChatbot settings={settings} />'

const newChatbot = `<StoreChatbot
        settings={settings}
        products={products}
        onApplyOrder={applyAiOrderItems}
      />`

if (
  !storefront.includes(
    oldChatbot,
  )
) {
  throw new Error(
    "Chamada atual de StoreChatbot nao encontrada.",
  )
}

storefront =
  storefront.replace(
    oldChatbot,
    newChatbot,
  )

if (
  storefront.includes(
    "<AiOrderAssistant",
  )
) {
  throw new Error(
    "O bloco grande de IA ainda existe no storefront.",
  )
}

if (
  !storefront.includes(
    "onApplyOrder={applyAiOrderItems}",
  )
) {
  throw new Error(
    "StoreChatbot nao foi conectado ao carrinho.",
  )
}

fs.writeFileSync(
  STOREFRONT_FILE,
  storefront,
  "utf8",
)

console.log("")
console.log("==============================================")
console.log("ETAPA 14.7.2 APLICADA")
console.log("==============================================")
console.log("- Pedido por texto movido para o chatbot")
console.log("- Pedido por audio movido para o chatbot")
console.log("- Bloco grande removido do cardapio")
console.log("- Controles ON/OFF respeitados")
console.log("- Resultado continua usando o carrinho real")
console.log("- Produtos com adicionais continuam abrindo personalizacao")
console.log("- Backups .bak1472 criados")
console.log("")
