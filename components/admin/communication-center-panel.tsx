"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Mail,
  Megaphone,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Ticket,
  UserCheck,
} from "lucide-react"

type TicketItem = {
  id: string
  subject: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  source: string
  status: string
  priority: string
  assignedUserId: string | null
  assignedUserName: string | null
  messageCount: number
  lastMessageAt: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

type TicketMessage = {
  id: string
  authorType: string
  channel: string
  body: string
  authorEmail: string | null
  createdAt: string
}

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  severity: string
  linkSection: string | null
  sourceEntityType: string | null
  sourceEntityId: string | null
  readAt: string | null
  createdAt: string
}

type Campaign = {
  id: string
  name: string
  audience: string
  channel: string
  status: string
  subject: string | null
  body: string
  couponCode: string | null
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

type Preferences = {
  inAppEnabled: boolean
  emailEnabled: boolean
  whatsappEnabled: boolean
  smsEnabled: boolean
  destinationEmail: string
  destinationPhone: string
  notifyNewTicket: boolean
  notifyCustomerReply: boolean
  notifyPaymentIssue: boolean
  notifyHandoff: boolean
  notifyContract: boolean
  notifyPrinter: boolean
  notifyLowStock: boolean
}

type Snapshot = {
  tickets: TicketItem[]
  notifications: NotificationItem[]
  campaigns: Campaign[]
  preferences: Preferences
}

type TabKey = "tickets" | "notifications" | "campaigns" | "preferences"

const emptyPreferences: Preferences = {
  inAppEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
  smsEnabled: false,
  destinationEmail: "",
  destinationPhone: "",
  notifyNewTicket: true,
  notifyCustomerReply: true,
  notifyPaymentIssue: true,
  notifyHandoff: true,
  notifyContract: true,
  notifyPrinter: true,
  notifyLowStock: true,
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Novo",
    open: "Em atendimento",
    waiting_customer: "Aguardando cliente",
    resolved: "Resolvido",
    closed: "Fechado",
    draft: "Rascunho",
    scheduled: "Agendada",
    sent: "Enviada",
    cancelled: "Cancelada",
  }
  return labels[status] || status
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" }
  return labels[priority] || priority
}

export function CommunicationCenterPanel() {
  const [tab, setTab] = useState<TabKey>("tickets")
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [reply, setReply] = useState("")
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences)

  const [ticketForm, setTicketForm] = useState({
    subject: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    priority: "normal",
    message: "",
  })

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    audience: "all",
    channel: "email",
    subject: "",
    body: "",
    couponCode: "",
    scheduledAt: "",
  })

  async function loadSnapshot() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/communication-center", { cache: "no-store" })
      const data = await response.json() as Snapshot & { error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a Central de Comunicação.")
      setSnapshot(data)
      setPreferences(data.preferences || emptyPreferences)
      if (selectedTicketId && !data.tickets.some((item) => item.id === selectedTicketId)) {
        setSelectedTicketId(null)
        setMessages([])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar.")
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(ticketId: string) {
    setError("")
    try {
      const response = await fetch(`/api/admin/communication-center?ticketId=${encodeURIComponent(ticketId)}`, { cache: "no-store" })
      const data = await response.json() as { messages?: TicketMessage[]; error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as mensagens.")
      setMessages(data.messages || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as mensagens.")
    }
  }

  async function postAction(payload: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/admin/communication-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as { ok?: boolean; id?: string; error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir.")
      return data
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void loadSnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedTicketId) void loadMessages(selectedTicketId)
  }, [selectedTicketId])

  const selectedTicket = useMemo(
    () => snapshot?.tickets.find((item) => item.id === selectedTicketId) || null,
    [snapshot, selectedTicketId],
  )

  const unreadNotifications = snapshot?.notifications.filter((item) => !item.readAt).length || 0
  const activeTickets = snapshot?.tickets.filter((item) => !["resolved", "closed"].includes(item.status)).length || 0
  const urgentTickets = snapshot?.tickets.filter((item) => item.priority === "urgent" && !["resolved", "closed"].includes(item.status)).length || 0

  async function createTicket() {
    try {
      const data = await postAction({ action: "create_ticket", ...ticketForm })
      setTicketForm({ subject: "", customerName: "", customerEmail: "", customerPhone: "", priority: "normal", message: "" })
      setShowTicketForm(false)
      await loadSnapshot()
      if (data.id) setSelectedTicketId(data.id)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível criar o chamado.")
    }
  }

  async function sendReply() {
    if (!selectedTicketId || !reply.trim()) return
    try {
      await postAction({ action: "ticket_message", ticketId: selectedTicketId, body: reply })
      setReply("")
      await Promise.all([loadMessages(selectedTicketId), loadSnapshot()])
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível registrar a resposta.")
    }
  }

  async function updateTicket(values: Record<string, unknown>) {
    if (!selectedTicketId) return
    try {
      await postAction({ action: "update_ticket", ticketId: selectedTicketId, ...values })
      await loadSnapshot()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível atualizar o chamado.")
    }
  }

  async function markNotification(id: string) {
    try {
      await postAction({ action: "mark_notification", notificationId: id })
      await loadSnapshot()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível marcar a notificação.")
    }
  }

  async function savePreferences() {
    try {
      await postAction({ action: "save_preferences", ...preferences })
      await loadSnapshot()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível salvar as preferências.")
    }
  }

  async function createCampaign() {
    try {
      await postAction({ action: "create_campaign", ...campaignForm })
      setCampaignForm({ name: "", audience: "all", channel: "email", subject: "", body: "", couponCode: "", scheduledAt: "" })
      setShowCampaignForm(false)
      await loadSnapshot()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível criar a campanha.")
    }
  }

  if (loading && !snapshot) {
    return <div className="rounded-3xl border border-gray-200 bg-white p-8 text-sm font-semibold text-gray-500">Carregando Central de Comunicação...</div>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">Central de Comunicação</p>
            <h2 className="mt-1 text-2xl font-black text-[#2f1c13]">Chamados, alertas e campanhas em um só lugar</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              Organize o atendimento da equipe e escolha como quer ser avisado. WhatsApp, SMS e envio externo entram conforme as integrações forem ativadas.
            </p>
          </div>
          <button type="button" onClick={() => void loadSnapshot()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-black text-orange-800 shadow-sm">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Ticket} label="Chamados ativos" value={String(activeTickets)} detail="Novos, em atendimento e aguardando cliente" />
        <StatCard icon={CircleAlert} label="Urgentes" value={String(urgentTickets)} detail="Chamados que precisam de prioridade" />
        <StatCard icon={Bell} label="Notificações novas" value={String(unreadNotifications)} detail="Alertas ainda não lidos" />
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        {([
          ["tickets", "Chamados", Ticket],
          ["notifications", "Notificações", Bell],
          ["campaigns", "Campanhas", Megaphone],
          ["preferences", "Preferências", Settings2],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${tab === key ? "bg-[#2f1c13] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            <Icon className="h-4 w-4" /> {label}
            {key === "notifications" && unreadNotifications > 0 && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] text-white">{unreadNotifications}</span>}
          </button>
        ))}
      </div>

      {tab === "tickets" && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="font-black text-gray-950">Chamados</h3><p className="text-xs text-gray-500">Acompanhe quem precisa de atenção.</p></div>
              <button type="button" onClick={() => setShowTicketForm((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-orange-500 px-3 text-xs font-black text-white"><Plus className="h-4 w-4" /> Novo</button>
            </div>

            {showTicketForm && (
              <div className="mt-4 space-y-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-3">
                <input value={ticketForm.subject} onChange={(event) => setTicketForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Assunto do chamado" className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-orange-400" />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <input value={ticketForm.customerName} onChange={(event) => setTicketForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Nome do cliente" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                  <input value={ticketForm.customerPhone} onChange={(event) => setTicketForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="Telefone" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                </div>
                <input value={ticketForm.customerEmail} onChange={(event) => setTicketForm((current) => ({ ...current, customerEmail: event.target.value }))} placeholder="E-mail" className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                <select value={ticketForm.priority} onChange={(event) => setTicketForm((current) => ({ ...current, priority: event.target.value }))} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
                  <option value="low">Prioridade baixa</option><option value="normal">Prioridade normal</option><option value="high">Prioridade alta</option><option value="urgent">Urgente</option>
                </select>
                <textarea value={ticketForm.message} onChange={(event) => setTicketForm((current) => ({ ...current, message: event.target.value }))} placeholder="Observação inicial" rows={3} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
                <button disabled={busy || !ticketForm.subject.trim()} type="button" onClick={() => void createTicket()} className="h-10 w-full rounded-xl bg-[#2f1c13] text-sm font-black text-white disabled:opacity-50">Criar chamado</button>
              </div>
            )}

            <div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto pr-1">
              {(snapshot?.tickets || []).map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedTicketId(item.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedTicketId === item.id ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-black text-gray-900">{item.subject}</p><PriorityBadge priority={item.priority} /></div>
                  <p className="mt-1 truncate text-xs text-gray-500">{item.customerName || item.customerEmail || item.customerPhone || "Sem identificação"}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400"><span>{statusLabel(item.status)}</span><span>{formatDate(item.lastMessageAt)}</span></div>
                </button>
              ))}
              {!snapshot?.tickets.length && <p className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">Nenhum chamado ainda.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            {!selectedTicket ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><MessageSquareText className="h-10 w-10 text-gray-300" /><h3 className="mt-3 font-black text-gray-800">Selecione um chamado</h3><p className="mt-1 text-sm text-gray-500">O histórico e as ações aparecem aqui.</p></div>
            ) : (
              <>
                <div className="border-b border-gray-100 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-gray-950">{selectedTicket.subject}</h3><PriorityBadge priority={selectedTicket.priority} /></div><p className="mt-1 text-sm text-gray-500">{selectedTicket.customerName || "Cliente"} · {selectedTicket.customerEmail || selectedTicket.customerPhone || "sem contato informado"}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void updateTicket({ assignToMe: true, status: "open" })} className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-black text-gray-700"><UserCheck className="h-4 w-4" /> Assumir</button>
                      <select value={selectedTicket.status} onChange={(event) => void updateTicket({ status: event.target.value })} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold">
                        <option value="new">Novo</option><option value="open">Em atendimento</option><option value="waiting_customer">Aguardando cliente</option><option value="resolved">Resolvido</option><option value="closed">Fechado</option>
                      </select>
                      <select value={selectedTicket.priority} onChange={(event) => void updateTicket({ priority: event.target.value })} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold">
                        <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="max-h-[480px] min-h-[320px] space-y-3 overflow-y-auto bg-gray-50/50 p-5">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.authorType === "staff" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.authorType === "staff" ? "bg-[#2f1c13] text-white" : "border border-gray-200 bg-white text-gray-800"}`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p><p className={`mt-2 text-[10px] ${message.authorType === "staff" ? "text-white/60" : "text-gray-400"}`}>{message.authorEmail || message.authorType} · {formatDate(message.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {!messages.length && <p className="pt-16 text-center text-sm text-gray-400">Nenhuma mensagem registrada.</p>}
                </div>
                <div className="border-t border-gray-100 p-4"><div className="flex gap-2"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Adicionar resposta ou observação interna..." rows={2} className="min-h-[48px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400" /><button disabled={busy || !reply.trim()} type="button" onClick={() => void sendReply()} className="inline-flex w-12 items-center justify-center rounded-xl bg-orange-500 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button></div><p className="mt-2 text-[11px] text-gray-400">Nesta etapa, a resposta fica registrada internamente. Envio por e-mail/WhatsApp será conectado aos canais oficiais.</p></div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><h3 className="font-black text-gray-950">Notificações</h3><p className="text-xs text-gray-500">Alertas importantes para a operação.</p></div><Bell className="h-5 w-5 text-orange-500" /></div>
          <div className="mt-4 space-y-2">
            {(snapshot?.notifications || []).map((item) => (
              <button key={item.id} type="button" onClick={() => !item.readAt && void markNotification(item.id)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${item.readAt ? "border-gray-100 bg-gray-50/60" : "border-orange-200 bg-orange-50/50"}`}>
                <div className={`mt-0.5 rounded-xl p-2 ${item.severity === "critical" ? "bg-red-100 text-red-700" : item.severity === "warning" ? "bg-amber-100 text-amber-700" : item.severity === "success" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}><Bell className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-black text-gray-900">{item.title}</p><span className="shrink-0 text-[11px] text-gray-400">{formatDate(item.createdAt)}</span></div>{item.body && <p className="mt-1 text-sm text-gray-600">{item.body}</p>}{!item.readAt && <p className="mt-2 text-[11px] font-bold text-orange-700">Clique para marcar como lida</p>}</div>
              </button>
            ))}
            {!snapshot?.notifications.length && <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">Nenhuma notificação ainda.</p>}
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-gray-950">Campanhas</h3><p className="text-xs text-gray-500">Prepare novidades, cupons e comunicados antes de conectar o envio externo.</p></div><button type="button" onClick={() => setShowCampaignForm((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white"><Plus className="h-4 w-4" /> Nova campanha</button></div>
            {showCampaignForm && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/50 p-4 lg:grid-cols-2">
                <input value={campaignForm.name} onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome interno da campanha" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                <input value={campaignForm.subject} onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Assunto do e-mail" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                <select value={campaignForm.audience} onChange={(event) => setCampaignForm((current) => ({ ...current, audience: event.target.value }))} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="all">Todos</option><option value="trial">Teste grátis</option><option value="monthly">Mensal</option><option value="semiannual">Semestral</option><option value="annual">Anual</option><option value="inactive">Inativos</option></select>
                <select value={campaignForm.channel} onChange={(event) => setCampaignForm((current) => ({ ...current, channel: event.target.value }))} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="both">E-mail + WhatsApp</option><option value="in_app">Dentro do SaborFlow</option></select>
                <input value={campaignForm.couponCode} onChange={(event) => setCampaignForm((current) => ({ ...current, couponCode: event.target.value }))} placeholder="Cupom opcional" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                <input type="datetime-local" value={campaignForm.scheduledAt} onChange={(event) => setCampaignForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                <textarea value={campaignForm.body} onChange={(event) => setCampaignForm((current) => ({ ...current, body: event.target.value }))} placeholder="Mensagem da campanha" rows={5} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm lg:col-span-2" />
                <div className="lg:col-span-2"><button disabled={busy || !campaignForm.name.trim() || !campaignForm.body.trim()} type="button" onClick={() => void createCampaign()} className="h-10 rounded-xl bg-[#2f1c13] px-5 text-sm font-black text-white disabled:opacity-50">Salvar campanha</button></div>
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(snapshot?.campaigns || []).map((item) => (
              <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.channel} · {item.audience}</p></div><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">{statusLabel(item.status)}</span></div><p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">{item.body}</p>{item.couponCode && <p className="mt-3 text-xs font-black text-orange-700">Cupom: {item.couponCode}</p>}<p className="mt-3 text-[11px] text-gray-400">{item.scheduledAt ? `Agendada: ${formatDate(item.scheduledAt)}` : `Criada: ${formatDate(item.createdAt)}`}</p></article>
            ))}
          </div>
        </div>
      )}

      {tab === "preferences" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-black text-gray-950">Onde você quer ser avisado?</h3><p className="mt-1 text-xs text-gray-500">Você pode preparar os canais agora e ativá-los quando estiverem conectados.</p><div className="mt-4 space-y-3"><ChannelToggle icon={Bell} label="Dentro do SaborFlow" description="Alertas no próprio painel" checked={preferences.inAppEnabled} onChange={(value) => setPreferences((current) => ({ ...current, inAppEnabled: value }))} /><ChannelToggle icon={Mail} label="E-mail" description="Usa o endereço configurado abaixo" checked={preferences.emailEnabled} onChange={(value) => setPreferences((current) => ({ ...current, emailEnabled: value }))} /><ChannelToggle icon={MessageSquareText} label="WhatsApp" description="Ative quando a Meta liberar a conexão oficial" checked={preferences.whatsappEnabled} onChange={(value) => setPreferences((current) => ({ ...current, whatsappEnabled: value }))} /><ChannelToggle icon={Phone} label="SMS" description="Canal opcional para alertas críticos" checked={preferences.smsEnabled} onChange={(value) => setPreferences((current) => ({ ...current, smsEnabled: value }))} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={preferences.destinationEmail} onChange={(event) => setPreferences((current) => ({ ...current, destinationEmail: event.target.value }))} placeholder="E-mail para alertas" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" /><input value={preferences.destinationPhone} onChange={(event) => setPreferences((current) => ({ ...current, destinationPhone: event.target.value }))} placeholder="Telefone para alertas" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" /></div></div>
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-black text-gray-950">O que deve gerar alerta?</h3><p className="mt-1 text-xs text-gray-500">Desative o que não for importante para você.</p><div className="mt-4 space-y-2"><PreferenceToggle label="Novo chamado" checked={preferences.notifyNewTicket} onChange={(value) => setPreferences((current) => ({ ...current, notifyNewTicket: value }))} /><PreferenceToggle label="Cliente respondeu chamado" checked={preferences.notifyCustomerReply} onChange={(value) => setPreferences((current) => ({ ...current, notifyCustomerReply: value }))} /><PreferenceToggle label="Problema de pagamento" checked={preferences.notifyPaymentIssue} onChange={(value) => setPreferences((current) => ({ ...current, notifyPaymentIssue: value }))} /><PreferenceToggle label="Cliente pediu atendente no WhatsApp" checked={preferences.notifyHandoff} onChange={(value) => setPreferences((current) => ({ ...current, notifyHandoff: value }))} /><PreferenceToggle label="Contrato aprovado" checked={preferences.notifyContract} onChange={(value) => setPreferences((current) => ({ ...current, notifyContract: value }))} /><PreferenceToggle label="Impressora com problema" checked={preferences.notifyPrinter} onChange={(value) => setPreferences((current) => ({ ...current, notifyPrinter: value }))} /><PreferenceToggle label="Estoque baixo" checked={preferences.notifyLowStock} onChange={(value) => setPreferences((current) => ({ ...current, notifyLowStock: value }))} /></div><button disabled={busy} type="button" onClick={() => void savePreferences()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2f1c13] px-5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Salvar preferências</button></div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Bell; label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-gray-500">{label}</p><p className="mt-1 text-3xl font-black text-gray-950">{value}</p></div><div className="rounded-xl bg-orange-50 p-2.5 text-orange-700"><Icon className="h-5 w-5" /></div></div><p className="mt-2 text-xs text-gray-400">{detail}</p></article>
}

function PriorityBadge({ priority }: { priority: string }) {
  const style = priority === "urgent" ? "bg-red-100 text-red-700" : priority === "high" ? "bg-amber-100 text-amber-700" : priority === "low" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${style}`}>{priorityLabel(priority)}</span>
}

function ChannelToggle({ icon: Icon, label, description, checked, onChange }: { icon: typeof Bell; label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-3"><div className="rounded-xl bg-orange-50 p-2 text-orange-700"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black text-gray-900">{label}</p><p className="text-xs text-gray-500">{description}</p></div><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-orange-500" /></label>
}

function PreferenceToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-100 px-3 py-2.5"><span className="text-sm font-semibold text-gray-700">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-orange-500" /></label>
}
