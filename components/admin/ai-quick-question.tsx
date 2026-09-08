"use client"

import { Bot, Power, Send } from "lucide-react"
import { useState, type FormEvent } from "react"
import type { StoreSettings } from "@/lib/types"

type AiResponse = {
  ok?: boolean
  reply?: string
  error?: string
  usage?: { totalTokens?: number }
}

export function AiQuickQuestion({
  settings,
  onSettingsChanged,
}: {
  settings: StoreSettings
  onSettingsChanged: (settings: StoreSettings) => void
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [busy, setBusy] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState("")
  const [tokens, setTokens] = useState<number | null>(null)

  const enabled = Boolean(settings.chatbotEnabled)

  async function toggleAi() {
    if (toggling) return

    setToggling(true)
    setError("")

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotEnabled: !enabled }),
      })

      const data = (await response.json()) as {
        settings?: StoreSettings
        error?: string
      }

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "NÃ£o foi possÃ­vel alterar a IA.")
      }

      onSettingsChanged(data.settings)

      if (enabled) {
        setQuestion("")
        setAnswer("")
        setTokens(null)
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao alterar a IA.",
      )
    } finally {
      setToggling(false)
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault()

    const clean = question.trim()
    if (!enabled || !clean || busy) return

    setBusy(true)
    setError("")
    setAnswer("")
    setTokens(null)

    try {
      const response = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: clean }],
        }),
      })

      const data = (await response.json()) as AiResponse

      if (!response.ok || !data.ok || !data.reply) {
        throw new Error(
          data.error || "NÃ£o foi possÃ­vel consultar a IA.",
        )
      }

      setAnswer(data.reply)
      setTokens(
        typeof data.usage?.totalTokens === "number"
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
    <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-950">
              Pergunte Ã  SaborFlow
            </h2>
            <p className="text-xs text-gray-500">
              Responde somente sobre {settings.storeName} e o SaborFlow.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleAi}
          disabled={toggling}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition disabled:opacity-50 ${
            enabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-gray-50 text-gray-500"
          }`}
        >
          <Power className="h-3.5 w-3.5" />
          {toggling ? "Salvando..." : enabled ? "IA ON" : "IA OFF"}
        </button>
      </div>

      <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, 1000))}
          disabled={!enabled || busy}
          placeholder={
            enabled
              ? "Ex.: Quanto vendi hoje? Quais produtos estÃ£o com estoque baixo?"
              : "Ative a IA para fazer perguntas sobre a empresa."
          }
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-orange-300 disabled:bg-gray-50 disabled:text-gray-400"
        />

        <button
          type="submit"
          disabled={!enabled || busy || !question.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy ? "Consultando..." : "Perguntar"}
        </button>
      </form>

      {answer ? (
        <div className="mt-3 rounded-xl bg-orange-50 px-4 py-3 text-sm leading-relaxed text-gray-800">
          {answer}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-bold text-red-600">{error}</p>
      ) : null}

      {tokens !== null ? (
        <p className="mt-2 text-[10px] font-semibold text-gray-400">
          {tokens.toLocaleString("pt-BR")} tokens nesta consulta
        </p>
      ) : null}
    </section>
  )
}
