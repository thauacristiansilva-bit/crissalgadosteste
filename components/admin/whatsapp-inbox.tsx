"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageCircle, RefreshCcw, Send, Sparkles } from "lucide-react"

type Contact = { phone: string; name: string; lastAt: string; connectionId: string; latestInboundAt: string | null }
type Incoming = { id: string; from: string; text: string; at: string; connectionId: string }
type Outgoing = { id: string; recipient: string; message: string; at: string; status: string; connectionId: string; error: string | null }
type Inbox = { contacts: Contact[]; incoming: Incoming[]; outgoing: Outgoing[] }

export function WhatsAppInbox() {
  const [data, setData] = useState<Inbox>({ contacts: [], incoming: [], outgoing: [] })
  const [selected, setSelected] = useState<Contact | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-inbox", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Falha ao carregar conversas.")
      setData(body)
      setSelected(current => body.contacts.find((item: Contact) => item.connectionId === current?.connectionId && item.phone === current.phone) || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar conversas.") }
  }, [])
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 20_000); return () => clearInterval(timer) }, [refresh])

  async function submit(action: "reply" | "suggest") {
    if (!selected) return
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, connectionId: selected.connectionId, recipient: selected.phone, message: draft }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Não foi possível concluir.")
      if (action === "suggest") setDraft(body.suggestion)
      else { setDraft(""); setNotice("Resposta colocada na fila. Confira o status abaixo e aguarde o envio."); await refresh() }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir.") }
    finally { setBusy(false) }
  }

  const messages = selected ? [
    ...data.incoming.filter(item => item.connectionId === selected.connectionId && item.from === selected.phone).map(item => ({ id: item.id, text: item.text, at: item.at, outgoing: false, status: "", error: null as string | null })),
    ...data.outgoing.filter(item => item.connectionId === selected.connectionId && item.recipient === selected.phone).map(item => ({ id: item.id, text: item.message, at: item.at, outgoing: true, status: item.status, error: item.error })),
  ].sort((a, b) => a.at.localeCompare(b.at)) : []
  const canReply = selected?.latestInboundAt && Date.now() - new Date(selected.latestInboundAt).getTime() < 23 * 3600_000
  return <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black"><MessageCircle className="h-5 w-5" />Atendimento WhatsApp</h2><p className="mt-1 text-sm text-slate-600">Conversas recebidas pela API oficial da Meta, em um só lugar.</p></div><button type="button" onClick={() => void refresh()} className="rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCcw className="inline h-4 w-4" /> Atualizar</button></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <div className="mt-4 grid min-h-[350px] gap-3 md:grid-cols-[230px_1fr]">
      <div className="max-h-[480px] overflow-y-auto rounded-xl border">{data.contacts.map(contact => <button key={`${contact.connectionId}:${contact.phone}`} type="button" onClick={() => { setSelected(contact); setDraft("") }} className={`w-full border-b px-3 py-3 text-left text-sm ${selected?.phone === contact.phone && selected.connectionId === contact.connectionId ? "bg-emerald-50" : "hover:bg-slate-50"}`}><strong className="block truncate">{contact.name}</strong><span className="text-xs text-slate-500">+{contact.phone}</span></button>)}{!data.contacts.length && <p className="p-3 text-sm text-slate-500">Ainda não há conversas. Confira a conexão e o webhook da Meta.</p>}</div>
      <div className="flex min-h-[350px] flex-col rounded-xl border bg-slate-50 p-3">{selected ? <><p className="border-b pb-2 text-sm font-bold">{selected.name} · +{selected.phone}</p><div className="flex-1 space-y-2 overflow-y-auto py-3" style={{ maxHeight: 340 }}>{messages.map(item => <div key={item.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${item.outgoing ? "ml-auto bg-emerald-100" : "bg-white"}`}><p className="whitespace-pre-wrap break-words">{item.text}</p><small className="mt-1 block text-slate-500">{new Date(item.at).toLocaleString("pt-BR")}{item.outgoing && ` · ${item.status}`}{item.error && ` · ${item.error}`}</small></div>)}</div><textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4096} rows={3} placeholder="Escreva sua resposta..." className="w-full rounded-xl border bg-white p-3 text-sm" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={busy || !data.incoming.some(item => item.from === selected.phone && item.connectionId === selected.connectionId)} onClick={() => void submit("suggest")} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"><Sparkles className="inline h-4 w-4" /> Sugerir com IA</button><button type="button" disabled={busy || !draft.trim() || !canReply} onClick={() => void submit("reply")} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="inline h-4 w-4" /> Enviar</button></div>{!canReply && <p className="mt-2 text-xs text-amber-800">Resposta livre disponível por até 24 horas após a mensagem do cliente. Para iniciar uma conversa, use um template aprovado.</p>}</> : <p className="m-auto text-sm text-slate-500">Selecione uma conversa.</p>}</div>
    </div>
  </section>
}
