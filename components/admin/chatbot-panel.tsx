"use client"

import { useState } from "react"
import { Bot, MessageCircle, Save } from "lucide-react"
import type { StoreSettings } from "@/lib/types"

export function ChatbotPanel({ settings, onSettingsChanged }: { settings: StoreSettings; onSettingsChanged: (settings: StoreSettings) => void }) {
  const [enabled, setEnabled] = useState(settings.chatbotEnabled)
  const [greeting, setGreeting] = useState(settings.chatbotGreeting)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function save() {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotEnabled: enabled, chatbotGreeting: greeting }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao salvar o atendimento.")
      onSettingsChanged(data.settings)
      setMessage("Atendimento atualizado.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="grid gap-5 xl:grid-cols-[1fr_.7fr]">
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Bot className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Atendimento do site</h2><p className="text-sm text-gray-500">Atendimento rápido no próprio site, com atalhos para dúvidas comuns.</p></div></div>
      <label className="mt-5 flex items-center justify-between rounded-xl border border-gray-200 p-4"><span><strong className="block text-sm">Ativar atendimento</strong><small className="text-gray-500">Exibe o botão de ajuda no cardápio do cliente.</small></span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5" /></label>
      <label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Mensagem inicial</span><textarea rows={4} value={greeting} onChange={(e) => setGreeting(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" /></label>
      <button onClick={save} disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy ? "Salvando..." : "Salvar atendimento"}</button>
      {message && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</p>}
    </section>
    <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-black">Respostas rápidas</h2>
      <div className="mt-4 space-y-2 text-sm text-gray-600"><div className="rounded-xl bg-gray-50 p-3"><strong>🕐 Horário</strong><p>{settings.openingHours}</p></div><div className="rounded-xl bg-gray-50 p-3"><strong>🛵 Entrega</strong><p>Explica prazo, zonas e orienta o cliente a marcar o ponto exato no Google Maps.</p></div><div className="rounded-xl bg-gray-50 p-3"><strong>💳 Pagamento</strong><p>Mostra os métodos habilitados pelo administrador.</p></div></div>
      <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white"><MessageCircle className="h-4 w-4" />Abrir WhatsApp da loja</a>
      <p className="mt-4 text-xs text-gray-400">Atualmente, este atendimento usa respostas rápidas configuradas pelo sistema. A evolução para IA e WhatsApp será feita em uma etapa separada, sem alterar o fluxo atual de pedidos.</p>
    </aside>
  </div>
}
