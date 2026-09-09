"use client"

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
