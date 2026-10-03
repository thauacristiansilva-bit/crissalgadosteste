"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCcw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react"

type Conversation = {
  status: "open" | "waiting" | "closed"
  aiMode: "ai" | "human"
  handoffRequested: boolean
  handoffReason: string | null
  labels: string[]
  assignedUserId: string | null
  assignedUserName: string | null
  closedByUserName: string | null
}

type Contact = {
  phone: string
  name: string
  lastAt: string
  connectionId: string
  latestInboundAt: string | null
  latestOutboundAt: string | null
  preview: string
  unreadCount: number
  windowExpiresAt: string | null
  canFreeReply: boolean
  conversation: Conversation
  orderCount: number
  latestOrder: { id: number; code: string; status: string; total: number; createdAt: string } | null
}

type Incoming = { id: string; from: string; text: string; at: string; connectionId: string; type: string }
type Outgoing = { id: string; recipient: string; message: string; at: string; status: string; connectionId: string; error: string | null; kind: string | null }
type Inbox = { contacts: Contact[]; incoming: Incoming[]; outgoing: Outgoing[] }

type Filter = "all" | "unread" | "human" | "ai" | "waiting" | "closed"

const LABELS = ["Pedido", "Reclamação", "Financeiro", "Entrega", "VIP", "Suporte"]

function formatPhone(value: string) {
  if (value.startsWith("55") && value.length >= 12) {
    const local = value.slice(2)
    const ddd = local.slice(0, 2)
    const rest = local.slice(2)
    return `+55 (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
  }
  return `+${value}`
}

function formatTime(value: string) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function windowText(expiresAt: string | null) {
  if (!expiresAt) return "Aguardando mensagem do cliente"
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return "Janela de 24h encerrada"
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.max(0, Math.floor((diff % 3_600_000) / 60_000))
  return `Janela aberta por ${hours}h ${minutes}min`
}

function orderStatus(status: string) {
  const map: Record<string, string> = {
    pending: "Pendente",
    accepted: "Aceito",
    preparing: "Preparando",
    ready: "Pronto",
    "in-route": "Em entrega",
    completed: "Concluído",
    cancelled: "Cancelado",
  }
  return map[status] || status
}

export function WhatsAppInbox() {
  const [data, setData] = useState<Inbox>({ contacts: [], incoming: [], outgoing: [] })
  const [selectedKey, setSelectedKey] = useState("")
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [, forceClock] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-inbox", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Falha ao carregar conversas.")
      setData(body)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar conversas.")
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 10_000)
    const clock = setInterval(() => forceClock(value => value + 1), 60_000)
    return () => { clearInterval(timer); clearInterval(clock) }
  }, [refresh])

  const selected = useMemo(
    () => data.contacts.find(contact => `${contact.connectionId}:${contact.phone}` === selectedKey) || null,
    [data.contacts, selectedKey],
  )

  useEffect(() => {
    if (!selectedKey && data.contacts[0]) setSelectedKey(`${data.contacts[0].connectionId}:${data.contacts[0].phone}`)
  }, [data.contacts, selectedKey])

  async function action(actionName: string, extra: Record<string, unknown> = {}, options: { quiet?: boolean } = {}) {
    if (!selected) return null
    setBusy(true)
    if (!options.quiet) { setError(""); setNotice("") }
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: actionName, connectionId: selected.connectionId, recipient: selected.phone, ...extra }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Não foi possível concluir.")
      await refresh()
      return body
    } catch (cause) {
      if (!options.quiet) setError(cause instanceof Error ? cause.message : "Não foi possível concluir.")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function selectContact(contact: Contact) {
    setSelectedKey(`${contact.connectionId}:${contact.phone}`)
    setDraft("")
    setNotice("")
    if (contact.unreadCount > 0) {
      setTimeout(() => {
        fetch("/api/admin/integrations/whatsapp-inbox", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "mark_read", connectionId: contact.connectionId, recipient: contact.phone }),
        }).then(() => refresh()).catch(() => undefined)
      }, 250)
    }
  }

  async function send(kind: "reply" | "template") {
    if (!draft.trim()) return
    const result = await action(kind, { message: draft })
    if (result) {
      setDraft("")
      setNotice(kind === "reply" ? "Mensagem colocada na fila de envio." : "Modelo aprovado colocado na fila de envio.")
    }
  }

  async function suggest() {
    const result = await action("suggest")
    if (result?.suggestion) setDraft(result.suggestion)
  }

  async function toggleLabel(label: string) {
    if (!selected) return
    const labels = selected.conversation.labels.includes(label)
      ? selected.conversation.labels.filter(item => item !== label)
      : [...selected.conversation.labels, label]
    await action("labels", { labels }, { quiet: true })
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return data.contacts.filter(contact => {
      const matchesSearch = !search || contact.name.toLowerCase().includes(search) || contact.phone.includes(search) || contact.preview.toLowerCase().includes(search)
      if (!matchesSearch) return false
      if (filter === "unread") return contact.unreadCount > 0
      if (filter === "human") return contact.conversation.aiMode === "human" || contact.conversation.handoffRequested
      if (filter === "ai") return contact.conversation.aiMode === "ai" && !contact.conversation.handoffRequested
      if (filter === "waiting") return contact.conversation.status === "waiting"
      if (filter === "closed") return contact.conversation.status === "closed"
      return contact.conversation.status !== "closed"
    })
  }, [data.contacts, query, filter])

  const messages = selected ? [
    ...data.incoming
      .filter(item => item.connectionId === selected.connectionId && item.from === selected.phone)
      .map(item => ({ id: item.id, text: item.text, at: item.at, outgoing: false, status: "", error: null as string | null })),
    ...data.outgoing
      .filter(item => item.connectionId === selected.connectionId && item.recipient === selected.phone)
      .map(item => ({ id: item.id, text: item.message, at: item.at, outgoing: true, status: item.status, error: item.error })),
  ].sort((a, b) => a.at.localeCompare(b.at)) : []

  const totalUnread = data.contacts.reduce((total, contact) => total + contact.unreadCount, 0)

  return <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black"><MessageCircle className="h-5 w-5 text-emerald-700" />Central WhatsApp</h2>
        <p className="mt-1 text-sm text-slate-600">Atendimento humano e IA trabalhando na mesma caixa de entrada.</p>
      </div>
      <div className="flex items-center gap-2">
        {totalUnread > 0 && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">{totalUnread} não lidas</span>}
        <button type="button" onClick={() => void refresh()} className="rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCcw className="inline h-4 w-4" /> Atualizar</button>
      </div>
    </div>

    {error && <p role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p className="m-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    <div className="grid min-h-[650px] lg:grid-cols-[290px_minmax(0,1fr)_270px]">
      <aside className="border-r bg-slate-50/70 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente ou telefone" className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm" />
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {(["all", "unread", "human", "ai", "waiting", "closed"] as Filter[]).map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-bold ${filter === item ? "bg-slate-900 text-white" : "border bg-white text-slate-600"}`}>
            {{ all: "Abertas", unread: "Não lidas", human: "Humano", ai: "IA", waiting: "Aguardando", closed: "Finalizadas" }[item]}
          </button>)}
        </div>

        <div className="mt-3 max-h-[540px] space-y-1 overflow-y-auto">
          {filtered.map(contact => {
            const active = selectedKey === `${contact.connectionId}:${contact.phone}`
            return <button key={`${contact.connectionId}:${contact.phone}`} type="button" onClick={() => void selectContact(contact)} className={`w-full rounded-2xl p-3 text-left transition ${active ? "bg-emerald-100 ring-1 ring-emerald-200" : "bg-white hover:bg-slate-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <strong className="min-w-0 truncate text-sm">{contact.name}</strong>
                <span className="shrink-0 text-[10px] text-slate-500">{formatTime(contact.lastAt)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-500">{contact.preview}</span>
                {contact.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white">{contact.unreadCount}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.conversation.handoffRequested ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Pediu atendente</span> : contact.conversation.aiMode === "ai" ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">IA ativa</span> : <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Humano</span>}
                {contact.latestOrder && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">Pedido {contact.latestOrder.code}</span>}
              </div>
            </button>
          })}
          {!filtered.length && <p className="p-4 text-center text-sm text-slate-500">Nenhuma conversa neste filtro.</p>}
        </div>
      </aside>

      <main className="flex min-w-0 flex-col bg-[#efeae2]">
        {selected ? <>
          <header className="border-b bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate">{selected.name}</strong>
                <span className="text-xs text-slate-500">{formatPhone(selected.phone)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selected.conversation.aiMode === "ai" && !selected.conversation.handoffRequested ? <button type="button" disabled={busy} onClick={() => void action("takeover")} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><UserRound className="inline h-4 w-4" /> Assumir atendimento</button> : <button type="button" disabled={busy} onClick={() => void action("resume_ai")} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Bot className="inline h-4 w-4" /> Reativar IA</button>}
                {selected.conversation.status === "closed" ? <button type="button" disabled={busy} onClick={() => void action("reopen")} className="rounded-xl border px-3 py-2 text-xs font-bold">Reabrir</button> : <button type="button" disabled={busy} onClick={() => void action("close")} className="rounded-xl border px-3 py-2 text-xs font-bold"><CheckCircle2 className="inline h-4 w-4" /> Finalizar</button>}
              </div>
            </div>
            {selected.conversation.handoffRequested && <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">O cliente pediu atendimento humano. A IA está pausada somente nesta conversa.</div>}
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: 455 }}>
            {messages.map(item => <div key={item.id} className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${item.outgoing ? "ml-auto bg-[#d9fdd3]" : "bg-white"}`}>
              <p className="whitespace-pre-wrap break-words">{item.text}</p>
              <small className="mt-1 block text-right text-[10px] text-slate-500">{new Date(item.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{item.outgoing && ` · ${item.status}`}{item.error && ` · ${item.error}`}</small>
            </div>)}
            {!messages.length && <p className="py-10 text-center text-sm text-slate-500">Ainda não há mensagens nesta conversa.</p>}
          </div>

          <footer className="border-t bg-white p-3">
            <div className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${selected.canFreeReply ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
              <Clock3 className="h-4 w-4" /> {windowText(selected.windowExpiresAt)}
            </div>
            <textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4096} rows={3} placeholder={selected.canFreeReply ? "Escreva sua resposta..." : "A janela fechou. Escreva a informação que será inserida no modelo aprovado..."} className="w-full resize-none rounded-xl border bg-white p-3 text-sm" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" disabled={busy || !data.incoming.some(item => item.from === selected.phone && item.connectionId === selected.connectionId)} onClick={() => void suggest()} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"><Sparkles className="inline h-4 w-4" /> Sugerir resposta</button>
              {selected.canFreeReply ? <button type="button" disabled={busy || !draft.trim()} onClick={() => void send("reply")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="inline h-4 w-4" /> Enviar</button> : <button type="button" disabled={busy || !draft.trim()} onClick={() => void send("template")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="inline h-4 w-4" /> Enviar modelo aprovado</button>}
            </div>
            {!selected.canFreeReply && <p className="mt-2 text-[11px] text-amber-800">Fora da janela de atendimento, o WhatsApp exige um modelo aprovado. Use este envio somente quando houver consentimento válido do cliente.</p>}
          </footer>
        </> : <div className="m-auto text-center text-sm text-slate-500"><MessageCircle className="mx-auto mb-2 h-8 w-8" />Selecione uma conversa.</div>}
      </main>

      <aside className="border-l bg-white p-4">
        {selected ? <div className="space-y-5">
          <div>
            <h3 className="text-sm font-black">Atendimento</h3>
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex justify-between gap-2"><span className="text-slate-500">Responsável</span><strong className="text-right">{selected.conversation.assignedUserName || (selected.conversation.aiMode === "ai" ? "IA do SaborFlow" : "Aguardando atendente")}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-slate-500">Status</span><strong>{{ open: "Aberto", waiting: "Aguardando", closed: "Finalizado" }[selected.conversation.status]}</strong></div>
              {selected.conversation.closedByUserName && <div className="flex justify-between gap-2"><span className="text-slate-500">Finalizado por</span><strong className="text-right">{selected.conversation.closedByUserName}</strong></div>}
            </div>
            {selected.conversation.status !== "closed" && <button type="button" disabled={busy} onClick={() => void action("waiting")} className="mt-3 w-full rounded-xl border px-3 py-2 text-xs font-bold">Marcar como aguardando cliente</button>}
          </div>

          <div className="border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><Tag className="h-4 w-4" />Etiquetas</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LABELS.map(label => <button key={label} type="button" disabled={busy} onClick={() => void toggleLabel(label)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selected.conversation.labels.includes(label) ? "bg-emerald-700 text-white" : "border bg-white text-slate-600"}`}>{label}</button>)}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><ShoppingBag className="h-4 w-4" />Pedidos deste cliente</h3>
            {selected.latestOrder ? <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs">
              <strong className="block">Pedido {selected.latestOrder.code}</strong>
              <div className="mt-1 flex justify-between"><span>{orderStatus(selected.latestOrder.status)}</span><span>R$ {selected.latestOrder.total.toFixed(2).replace(".", ",")}</span></div>
              <p className="mt-1 text-slate-500">{selected.orderCount} pedido(s) encontrado(s) para este telefone.</p>
            </div> : <p className="mt-2 text-xs text-slate-500">Nenhum pedido encontrado com este telefone.</p>}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-black">Regra das 24 horas</h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">Cada nova mensagem recebida do cliente abre novamente a janela de atendimento por 24 horas. Dentro dela, atendente e IA podem responder normalmente. Fora dela, use um modelo aprovado.</p>
          </div>
        </div> : <p className="text-sm text-slate-500">Os dados do cliente aparecem aqui.</p>}
      </aside>
    </div>
  </section>
}
