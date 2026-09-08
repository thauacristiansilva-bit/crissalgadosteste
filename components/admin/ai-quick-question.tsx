"use client"

import {
  Bot,
  Power,
  Send,
  X,
} from "lucide-react"
import {
  useEffect,
  useState,
  type FormEvent,
} from "react"

import type {
  StoreSettings,
} from "@/lib/types"

type DailyUsage = {
  used: number
  limit: number
  remaining: number
  periodKey: string
}

type AiResponse = {
  ok?: boolean
  reply?: string
  error?: string
  usage?: {
    totalTokens?: number
  }
  dailyUsage?: DailyUsage
}

const initialUsage: DailyUsage = {
  used: 0,
  limit: 30,
  remaining: 30,
  periodKey: "",
}

export function AiQuickQuestion({
  settings,
  onSettingsChanged,
}: {
  settings: StoreSettings
  onSettingsChanged: (
    settings: StoreSettings,
  ) => void
}) {
  const [question, setQuestion] =
    useState("")
  const [answer, setAnswer] =
    useState("")
  const [busy, setBusy] =
    useState(false)
  const [toggling, setToggling] =
    useState(false)
  const [error, setError] =
    useState("")
  const [tokens, setTokens] =
    useState<number | null>(null)
  const [dailyUsage, setDailyUsage] =
    useState<DailyUsage>(initialUsage)
  const [open, setOpen] =
    useState(false)

  const enabled =
    Boolean(settings.chatbotEnabled)

  const limitReached =
    dailyUsage.remaining <= 0

  useEffect(() => {
    let active = true

    async function loadUsage() {
      try {
        const response = await fetch(
          "/api/admin/ai/chat",
          {
            method: "GET",
            cache: "no-store",
          },
        )

        const data =
          (await response.json()) as AiResponse

        if (
          active &&
          data.dailyUsage
        ) {
          setDailyUsage(
            data.dailyUsage,
          )
        }
      } catch {
        // O contador será atualizado na primeira consulta válida.
      }
    }

    void loadUsage()

    return () => {
      active = false
    }
  }, [])

  async function toggleAi() {
    if (toggling) return

    setToggling(true)
    setError("")

    try {
      const response = await fetch(
        "/api/settings",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            chatbotEnabled: !enabled,
          }),
        },
      )

      const data =
        (await response.json()) as {
          settings?: StoreSettings
          error?: string
        }

      if (
        !response.ok ||
        !data.settings
      ) {
        throw new Error(
          data.error ||
            "Não foi possível alterar a IA.",
        )
      }

      onSettingsChanged(
        data.settings,
      )

      if (enabled) {
        setQuestion("")
        setAnswer("")
        setTokens(null)
        setOpen(false)
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao alterar a IA.",
      )
      setOpen(true)
    } finally {
      setToggling(false)
    }
  }

  async function ask(
    event: FormEvent,
  ) {
    event.preventDefault()

    const clean =
      question.trim()

    if (
      !enabled ||
      !clean ||
      busy ||
      limitReached
    ) {
      return
    }

    setBusy(true)
    setError("")
    setAnswer("")
    setTokens(null)
    setOpen(true)

    try {
      const response = await fetch(
        "/api/admin/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: clean,
              },
            ],
          }),
        },
      )

      const data =
        (await response.json()) as AiResponse

      if (data.dailyUsage) {
        setDailyUsage(
          data.dailyUsage,
        )
      }

      if (
        !response.ok ||
        !data.ok ||
        !data.reply
      ) {
        throw new Error(
          data.error ||
            "Não foi possível consultar a IA.",
        )
      }

      setAnswer(data.reply)

      setTokens(
        typeof data.usage
          ?.totalTokens === "number"
          ? data.usage.totalTokens
          : null,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao consultar a IA.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1.5">
        <form
          onSubmit={ask}
          className="flex min-w-0 items-center gap-1.5"
        >
          <div className="flex h-10 w-[260px] items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/60 px-3 xl:w-[330px]">
            <Bot className="h-4 w-4 shrink-0 text-orange-700" />

            <input
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value.slice(
                    0,
                    1000,
                  ),
                )
              }
              disabled={
                !enabled ||
                busy ||
                limitReached
              }
              placeholder={
                !enabled
                  ? "IA desativada"
                  : limitReached
                    ? "Limite diário atingido"
                    : "Pergunte à SaborFlow..."
              }
              aria-label="Pergunte à SaborFlow"
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-gray-800 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={
              !enabled ||
              busy ||
              !question.trim() ||
              limitReached
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Perguntar à SaborFlow"
            title="Perguntar à SaborFlow"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={toggleAi}
          disabled={toggling}
          className={`hidden h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-black transition xl:inline-flex ${
            enabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-gray-50 text-gray-500"
          }`}
          title={
            enabled
              ? "Desativar IA desta empresa"
              : "Ativar IA desta empresa"
          }
        >
          <Power className="h-3.5 w-3.5" />
          {toggling
            ? "..."
            : enabled
              ? "IA ON"
              : "IA OFF"}
        </button>

        <span
          className={`hidden shrink-0 rounded-lg px-2 py-1 text-[10px] font-black xl:inline-flex ${
            limitReached
              ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-500"
          }`}
          title="Uso diário desta empresa"
        >
          {dailyUsage.used}/{dailyUsage.limit} hoje
        </span>
      </div>

      {(open || answer || error) && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-orange-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">
                SaborFlow IA
              </p>

              {busy ? (
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  Consultando os dados da empresa...
                </p>
              ) : answer ? (
                <p className="mt-2 text-sm leading-6 text-gray-800">
                  {answer}
                </p>
              ) : error ? (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  {error}
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Faça uma pergunta sobre a sua empresa ou sobre o SaborFlow.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-400">
                <span>
                  {dailyUsage.used}/{dailyUsage.limit} perguntas hoje
                </span>

                <span>•</span>

                <span>
                  {dailyUsage.remaining} restantes
                </span>

                {tokens !== null ? (
                  <>
                    <span>•</span>
                    <span>
                      {tokens.toLocaleString(
                        "pt-BR",
                      )}{" "}
                      tokens nesta consulta
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar resposta da IA"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
