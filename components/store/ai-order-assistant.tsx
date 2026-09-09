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
            "NÃ£o foi possÃ­vel interpretar o pedido.",
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
        "Seu navegador nÃ£o suporta gravaÃ§Ã£o de Ã¡udio.",
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
        "NÃ£o foi possÃ­vel acessar o microfone. Verifique a permissÃ£o do navegador.",
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
              PeÃ§a por texto ou Ã¡udio
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
                ? "Parar gravaÃ§Ã£o"
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
            MÃ¡ximo de 30 segundos.
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
                            Ã—{" "}
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
                        â€¢ {item}
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