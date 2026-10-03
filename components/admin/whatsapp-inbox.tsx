"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  UserRound,
  X,
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
type WhatsAppTemplate = {
  id: string
  connectionId: string
  name: string
  label: string
  languageCode: string
  category: "utility" | "marketing" | "authentication"
  status: "draft" | "submitted" | "approved" | "rejected" | "paused" | "disabled"
  body: string
  useCase: string | null
  variableCount: number
  metaTemplateId: string | null
  rejectionReason: string | null
  updatedAt: string
}
type InternalNote = { id: string; connectionId: string; contactPhone: string; body: string; authorName: string; createdAt: string }
type ConversationEvent = {
  id: string
  connectionId: string
  contactPhone: string
  eventType: string
  actorType: "ai" | "user" | "system"
  actorName: string | null
  metadata: Record<string, unknown>
  createdAt: string
}
type Inbox = {
  contacts: Contact[]
  incoming: Incoming[]
  outgoing: Outgoing[]
  templates: WhatsAppTemplate[]
  notes: InternalNote[]
  activity: ConversationEvent[]
}

type Filter = "all" | "unread" | "human" | "ai" | "waiting" | "closed"

const LABELS = ["Pedido", "Reclamação", "Financeiro", "Entrega", "VIP", "Suporte"]
const EMPTY_INBOX: Inbox = { contacts: [], incoming: [], outgoing: [], templates: [], notes: [], activity: [] }

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

function eventLabel(event: ConversationEvent) {
  const labels: Record<string, string> = {
    human_takeover: "Atendente assumiu a conversa",
    ai_resumed: "IA reativada",
    conversation_closed: "Atendimento finalizado",
    conversation_reopened: "Atendimento reaberto",
    waiting_customer: "Aguardando resposta do cliente",
    labels_updated: "Etiquetas alteradas",
    automatic_labels: "Etiquetas automáticas aplicadas",
    internal_note_added: "Nota interna adicionada",
    staff_reply_queued: "Resposta do atendente enviada para a fila",
    ai_reply_queued: "Resposta da IA enviada para a fila",
    handoff_message_queued: "Mensagem de transferência enviada",
    handoff_requested: "Cliente direcionado para atendimento humano",
    template_queued: "Modelo aprovado enviado para a fila",
  }
  return labels[event.eventType] || event.eventType.replaceAll("_", " ")
}

function templateStatus(status: WhatsAppTemplate["status"]) {
  return ({
    draft: "Rascunho",
    submitted: "Enviado à Meta",
    approved: "Aprovado",
    rejected: "Rejeitado",
    paused: "Pausado",
    disabled: "Desativado",
  } as const)[status]
}

function defaultTemplateForm(connectionId = "") {
  return {
    id: "",
    connectionId,
    name: "",
    label: "",
    languageCode: "pt_BR",
    category: "utility" as WhatsAppTemplate["category"],
    status: "draft" as WhatsAppTemplate["status"],
    body: "",
    useCase: "",
    metaTemplateId: "",
    rejectionReason: "",
  }
}

export function WhatsAppInbox() {
  const [data, setData] = useState<Inbox>(EMPTY_INBOX)
  const [selectedKey, setSelectedKey] = useState("")
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [noteDraft, setNoteDraft] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateParameters, setTemplateParameters] = useState<string[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateForm, setTemplateForm] = useState(defaultTemplateForm())
  const [, forceClock] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-inbox", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Falha ao carregar conversas.")
      setData({ ...EMPTY_INBOX, ...body })
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

  const connectionTemplates = useMemo(
    () => selected ? data.templates.filter(template => template.connectionId === selected.connectionId) : [],
    [data.templates, selected],
  )
  const approvedTemplates = useMemo(() => connectionTemplates.filter(template => template.status === "approved"), [connectionTemplates])
  const selectedTemplate = useMemo(
    () => approvedTemplates.find(template => template.id === selectedTemplateId) || null,
    [approvedTemplates, selectedTemplateId],
  )

  useEffect(() => {
    if (!selected || selected.canFreeReply) return
    const first = approvedTemplates[0]
    if (first && !approvedTemplates.some(template => template.id === selectedTemplateId)) {
      setSelectedTemplateId(first.id)
      setTemplateParameters(Array.from({ length: first.variableCount }, () => ""))
    }
    if (!first) {
      setSelectedTemplateId("")
      setTemplateParameters([])
    }
  }, [approvedTemplates, selected, selectedTemplateId])

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
    setNoteDraft("")
    setNotice("")
    setSelectedTemplateId("")
    setTemplateParameters([])
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

  async function sendReply() {
    if (!draft.trim()) return
    const result = await action("reply", { message: draft })
    if (result) {
      setDraft("")
      setNotice("Mensagem colocada na fila de envio.")
    }
  }

  async function sendTemplate() {
    if (!selectedTemplate) return
    const result = await action("template", { templateId: selectedTemplate.id, templateParameters })
    if (result) setNotice(`Modelo “${selectedTemplate.label}” colocado na fila de envio.`)
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

  async function addNote() {
    if (!noteDraft.trim()) return
    const result = await action("note", { note: noteDraft })
    if (result) {
      setNoteDraft("")
      setNotice("Nota interna adicionada. O cliente não vê essa informação.")
    }
  }

  function editTemplate(template: WhatsAppTemplate) {
    setTemplateForm({
      id: template.id,
      connectionId: template.connectionId,
      name: template.name,
      label: template.label,
      languageCode: template.languageCode,
      category: template.category,
      status: template.status,
      body: template.body,
      useCase: template.useCase || "",
      metaTemplateId: template.metaTemplateId || "",
      rejectionReason: template.rejectionReason || "",
    })
  }

  async function saveTemplate() {
    if (!selected) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          ...templateForm,
          connectionId: selected.connectionId,
          templateBody: templateForm.body,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar o modelo.")
      setTemplateForm(defaultTemplateForm(selected.connectionId))
      setNotice("Modelo salvo.")
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o modelo.")
    } finally {
      setBusy(false)
    }
  }

  async function removeTemplate(templateId: string) {
    if (!confirm("Excluir este modelo do SaborFlow? Isso não exclui o modelo na Meta.")) return
    setBusy(true)
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id: templateId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Não foi possível excluir.")
      setTemplateForm(defaultTemplateForm(selected?.connectionId || ""))
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir.")
    } finally {
      setBusy(false)
    }
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

  const notes = selected
    ? data.notes.filter(note => note.connectionId === selected.connectionId && note.contactPhone === selected.phone)
    : []
  const activity = selected
    ? data.activity.filter(event => event.connectionId === selected.connectionId && event.contactPhone === selected.phone).slice(0, 12)
    : []

  const totalUnread = data.contacts.reduce((total, contact) => total + contact.unreadCount, 0)

  return <>
    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><MessageCircle className="h-5 w-5 text-emerald-700" />Central WhatsApp</h2>
          <p className="mt-1 text-sm text-slate-600">Atendimento humano, IA, modelos aprovados, notas internas e histórico no mesmo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">{totalUnread} não lidas</span>}
          <button type="button" disabled={!selected} onClick={() => {
            if (selected) setTemplateForm(defaultTemplateForm(selected.connectionId))
            setShowTemplates(true)
          }} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"><FileText className="inline h-4 w-4" /> Modelos</button>
          <button type="button" onClick={() => void refresh()} className="rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCcw className="inline h-4 w-4" /> Atualizar</button>
        </div>
      </div>

      {error && <p role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="m-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <div className="grid min-h-[700px] lg:grid-cols-[290px_minmax(0,1fr)_300px]">
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

          <div className="mt-3 max-h-[585px] space-y-1 overflow-y-auto">
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

            <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: 470 }}>
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
              {selected.canFreeReply ? <>
                <textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={4096} rows={3} placeholder="Escreva sua resposta..." className="w-full resize-none rounded-xl border bg-white p-3 text-sm" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" disabled={busy || !data.incoming.some(item => item.from === selected.phone && item.connectionId === selected.connectionId)} onClick={() => void suggest()} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"><Sparkles className="inline h-4 w-4" /> Sugerir resposta</button>
                  <button type="button" disabled={busy || !draft.trim()} onClick={() => void sendReply()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="inline h-4 w-4" /> Enviar</button>
                </div>
              </> : <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-700">Modelo aprovado</label>
                  <button type="button" onClick={() => setShowTemplates(true)} className="text-xs font-bold text-emerald-700">Gerenciar modelos</button>
                </div>
                <select value={selectedTemplateId} onChange={event => {
                  const id = event.target.value
                  setSelectedTemplateId(id)
                  const template = approvedTemplates.find(item => item.id === id)
                  setTemplateParameters(Array.from({ length: template?.variableCount || 0 }, () => ""))
                }} className="w-full rounded-xl border bg-white p-2.5 text-sm">
                  {!approvedTemplates.length && <option value="">Nenhum modelo aprovado cadastrado</option>}
                  {approvedTemplates.map(template => <option key={template.id} value={template.id}>{template.label} · {template.name}</option>)}
                </select>
                {selectedTemplate && <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-700">
                  <strong className="block text-slate-900">Prévia</strong>
                  <p className="mt-1 whitespace-pre-wrap">{selectedTemplate.body}</p>
                </div>}
                {selectedTemplate && Array.from({ length: selectedTemplate.variableCount }, (_, index) => <input key={index} value={templateParameters[index] || ""} onChange={event => setTemplateParameters(values => {
                  const next = [...values]
                  next[index] = event.target.value
                  return next
                })} placeholder={`Valor de {{${index + 1}}}`} className="w-full rounded-xl border bg-white p-2.5 text-sm" />)}
                <button type="button" disabled={busy || !selectedTemplate || templateParameters.some(value => !value.trim())} onClick={() => void sendTemplate()} className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send className="inline h-4 w-4" /> Enviar modelo aprovado</button>
                <p className="text-[11px] text-amber-800">Fora da janela de atendimento, use somente modelos realmente aprovados na Meta e respeite o consentimento e a finalidade da mensagem.</p>
              </div>}
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
              <p className="mt-2 text-[10px] leading-4 text-slate-500">Pedido, reclamação, financeiro, entrega e suporte também podem ser marcados automaticamente pela mensagem recebida.</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-black"><StickyNote className="h-4 w-4" />Notas internas</h3>
              <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={2} maxLength={2000} placeholder="Ex.: cliente pediu retorno após 18h..." className="mt-2 w-full resize-none rounded-xl border p-2.5 text-xs" />
              <button type="button" disabled={busy || !noteDraft.trim()} onClick={() => void addNote()} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus className="inline h-3.5 w-3.5" /> Adicionar nota</button>
              <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                {notes.map(note => <div key={note.id} className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-950">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  <small className="mt-1 block text-amber-700">{note.authorName} · {new Date(note.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                </div>)}
                {!notes.length && <p className="text-[11px] text-slate-500">Nenhuma nota interna.</p>}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4" />Histórico do atendimento</h3>
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                {activity.map(event => <div key={event.id} className="border-l-2 border-slate-200 pl-2 text-[11px]">
                  <strong className="block text-slate-700">{eventLabel(event)}</strong>
                  <span className="text-slate-500">{event.actorName || (event.actorType === "ai" ? "IA do SaborFlow" : "Sistema")} · {new Date(event.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>)}
                {!activity.length && <p className="text-[11px] text-slate-500">O histórico será criado conforme o atendimento for utilizado.</p>}
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
              <p className="mt-2 text-xs leading-5 text-slate-600">Cada nova mensagem recebida do cliente abre novamente a janela de atendimento por 24 horas. Dentro dela, o sistema envia texto livre. Fora dela, somente um modelo aprovado.</p>
            </div>
          </div> : <p className="text-sm text-slate-500">Os dados do cliente aparecem aqui.</p>}
        </aside>
      </div>
    </section>

    {showTemplates && selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={event => { if (event.currentTarget === event.target) setShowTemplates(false) }}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h3 className="font-black">Modelos do WhatsApp</h3>
            <p className="text-xs text-slate-500">Cadastre aqui os modelos da Meta. Apenas os marcados como aprovados ficam disponíveis para envio.</p>
          </div>
          <button type="button" onClick={() => setShowTemplates(false)} className="rounded-xl border p-2"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-sm">Modelos cadastrados</strong>
              <button type="button" onClick={() => setTemplateForm(defaultTemplateForm(selected.connectionId))} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"><Plus className="inline h-3.5 w-3.5" /> Novo</button>
            </div>
            <div className="space-y-2">
              {connectionTemplates.map(template => <div key={template.id} className="rounded-2xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => editTemplate(template)} className="min-w-0 flex-1 text-left">
                    <strong className="block truncate text-sm">{template.label}</strong>
                    <span className="block truncate text-[11px] text-slate-500">{template.name} · {template.languageCode}</span>
                  </button>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${template.status === "approved" ? "bg-emerald-100 text-emerald-800" : template.status === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{templateStatus(template.status)}</span>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">{template.body}</p>
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => void removeTemplate(template.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label="Excluir modelo"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>)}
              {!connectionTemplates.length && <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-slate-500">Nenhum modelo cadastrado nesta conexão.</div>}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <strong className="text-sm">{templateForm.id ? "Editar modelo" : "Cadastrar modelo"}</strong>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">Use o mesmo nome e idioma configurados na Meta. Para variáveis no corpo, use <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code> e assim por diante.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">Nome na Meta
                <input value={templateForm.name} onChange={event => setTemplateForm(value => ({ ...value, name: event.target.value }))} placeholder="pedido_pronto" className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal" />
              </label>
              <label className="text-xs font-bold">Título interno
                <input value={templateForm.label} onChange={event => setTemplateForm(value => ({ ...value, label: event.target.value }))} placeholder="Pedido pronto para retirada" className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal" />
              </label>
              <label className="text-xs font-bold">Idioma
                <input value={templateForm.languageCode} onChange={event => setTemplateForm(value => ({ ...value, languageCode: event.target.value }))} placeholder="pt_BR" className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal" />
              </label>
              <label className="text-xs font-bold">Categoria
                <select value={templateForm.category} onChange={event => setTemplateForm(value => ({ ...value, category: event.target.value as WhatsAppTemplate["category"] }))} className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal">
                  <option value="utility">Utilidade</option>
                  <option value="marketing">Marketing</option>
                  <option value="authentication">Autenticação</option>
                </select>
              </label>
              <label className="text-xs font-bold">Status na Meta
                <select value={templateForm.status} onChange={event => setTemplateForm(value => ({ ...value, status: event.target.value as WhatsAppTemplate["status"] }))} className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal">
                  <option value="draft">Rascunho</option>
                  <option value="submitted">Enviado à Meta</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>
                  <option value="paused">Pausado</option>
                  <option value="disabled">Desativado</option>
                </select>
              </label>
              <label className="text-xs font-bold">Uso
                <select value={templateForm.useCase} onChange={event => setTemplateForm(value => ({ ...value, useCase: event.target.value }))} className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal">
                  <option value="">Outro</option>
                  <option value="order_received">Pedido recebido</option>
                  <option value="order_confirmed">Pedido confirmado</option>
                  <option value="order_ready">Pedido pronto</option>
                  <option value="out_for_delivery">Saiu para entrega</option>
                  <option value="payment_pending">Pagamento pendente</option>
                  <option value="payment_approved">Pagamento aprovado</option>
                  <option value="customer_recovery">Recuperação de cliente</option>
                  <option value="coupon">Cupom</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold">Texto do modelo
              <textarea value={templateForm.body} onChange={event => setTemplateForm(value => ({ ...value, body: event.target.value }))} rows={6} placeholder="Olá! Seu pedido {{1}} está pronto para retirada." className="mt-1 w-full resize-y rounded-xl border bg-white p-2.5 font-normal" />
            </label>
            {templateForm.status === "rejected" && <label className="mt-3 block text-xs font-bold">Motivo da rejeição
              <textarea value={templateForm.rejectionReason} onChange={event => setTemplateForm(value => ({ ...value, rejectionReason: event.target.value }))} rows={2} className="mt-1 w-full rounded-xl border bg-white p-2.5 font-normal" />
            </label>}
            <div className="mt-4 rounded-xl bg-blue-50 p-3 text-[11px] leading-4 text-blue-900">Nesta etapa, o SaborFlow guarda e utiliza os modelos já criados/aprovados na Meta. A sincronização automática do status com a Meta será ligada depois que o Embedded Signup estiver liberado para produção.</div>
            <button type="button" disabled={busy || !templateForm.name.trim() || !templateForm.label.trim() || !templateForm.body.trim()} onClick={() => void saveTemplate()} className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Salvar modelo</button>
          </div>
        </div>
      </div>
    </div>}
  </>
}
