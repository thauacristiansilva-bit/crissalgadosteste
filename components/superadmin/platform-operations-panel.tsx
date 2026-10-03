"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  BellRing,
  FileCheck2,
  MailWarning,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Send,
  TicketCheck,
} from "lucide-react"
import type { PlatformInsights } from "@/lib/superadmin-platform-insights"

function date(value: string) {
  if (!value) return "—"
  return new Date(value).toLocaleString("pt-BR")
}

function Stat({ label, value, note, icon: Icon, attention = false }: { label: string; value: number; note: string; icon: typeof FileCheck2; attention?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 ${attention && value > 0 ? "border-amber-500/30 bg-amber-500/[0.07]" : "border-white/10 bg-white/[0.04]"}`}>
      <Icon className={`h-5 w-5 ${attention && value > 0 ? "text-amber-300" : "text-orange-400"}`} />
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-black text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{note}</p>
    </article>
  )
}

export function PlatformOperationsPanel() {
  const [data, setData] = useState<PlatformInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/superadmin/platform-insights", { cache: "no-store" })
      const result = await response.json() as { data?: PlatformInsights; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "Falha ao carregar operação da plataforma.")
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar operação da plataforma.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) return <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-stone-400">Carregando operação SaaS...</p>
  if (!data) return <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-200">{error || "Não foi possível carregar os dados."}</div>

  const m = data.metrics

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div>
          <p className="font-black">Operação SaaS em tempo real</p>
          <p className="mt-1 text-xs text-stone-500">Contratos, WhatsApp, atendimento e filas técnicas do SaborFlow.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black hover:bg-white/10 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Contratos assinados" value={m.signedContracts} note={`${m.approvedContracts} já aprovados por pagamento.`} icon={FileCheck2} />
        <Stat label="Contrato/e-mail pendente" value={m.contractEmailsPending + m.contractEmailFailures} note={`${m.contractEmailsPending} aguardando e-mail · ${m.contractEmailFailures} com falha.`} icon={MailWarning} attention />
        <Stat label="WhatsApps ativos" value={m.whatsappActiveConnections} note={`${m.whatsappErrorConnections} conexão(ões) com erro.`} icon={MessageCircle} attention={m.whatsappErrorConnections > 0} />
        <Stat label="Atendimento humano" value={m.whatsappHumanHandoffs} note={`${m.whatsappOpenConversations} conversa(s) WhatsApp abertas.`} icon={BellRing} attention />
        <Stat label="Chamados abertos" value={m.openTickets} note={`${m.urgentTickets} marcado(s) como urgente.`} icon={TicketCheck} attention={m.urgentTickets > 0} />
        <Stat label="Mensagens com falha" value={m.failedMessages} note={`${m.queuedMessages} item(ns) aguardando/processando na fila.`} icon={Send} attention />
        <Stat label="Campanhas agendadas" value={m.scheduledCampaigns} note={`${m.draftCampaigns} campanha(s) ainda em rascunho.`} icon={Megaphone} />
        <Stat label="Alertas técnicos" value={m.whatsappErrorConnections + m.contractEmailFailures + m.failedMessages} note="Soma dos pontos que merecem verificação operacional." icon={AlertTriangle} attention />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-black">Clientes pedindo atendente</h3><span className="text-xs text-stone-500">{data.handoffs.length} recentes</span></div>
          <div className="mt-4 space-y-2">
            {data.handoffs.length === 0 && <p className="text-sm text-stone-500">Nenhuma conversa aguardando intervenção humana.</p>}
            {data.handoffs.map((item, index) => (
              <article key={`${item.contactPhone}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-black">{item.contactName} · {item.organizationName}</p><p className="text-xs text-stone-500">{item.contactPhone}</p></div>
                  <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-black uppercase text-amber-300">humano</span>
                </div>
                {item.reason && <p className="mt-2 text-xs text-stone-300">{item.reason}</p>}
                <p className="mt-2 text-[11px] text-stone-600">Atualizado {date(item.updatedAt)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-black">Chamados que precisam de atenção</h3><span className="text-xs text-stone-500">{data.tickets.length} recentes</span></div>
          <div className="mt-4 space-y-2">
            {data.tickets.length === 0 && <p className="text-sm text-stone-500">Nenhum chamado aberto.</p>}
            {data.tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-black">{ticket.subject}</p><p className="text-xs text-stone-500">{ticket.organizationName}</p></div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${ticket.priority === "urgent" ? "bg-red-500/15 text-red-300" : ticket.priority === "high" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-stone-300"}`}>{ticket.priority}</span>
                </div>
                <p className="mt-2 text-[11px] text-stone-600">{ticket.status} · {date(ticket.updatedAt)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-black">Contratos / e-mails com atenção</h3>
          <div className="mt-4 space-y-2">
            {data.contractAlerts.length === 0 && <p className="text-sm text-stone-500">Nenhuma pendência de contrato encontrada.</p>}
            {data.contractAlerts.map((contract) => (
              <article key={contract.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-black">{contract.email || "Cliente sem e-mail"}</p>
                <p className="mt-1 text-xs text-stone-400">{contract.planCode} · {contract.billingCycle} · {contract.paymentMethod} · {contract.status}</p>
                {contract.emailError && <p className="mt-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-200">{contract.emailError}</p>}
                <p className="mt-2 text-[11px] text-stone-600">Assinado {date(contract.signedAt)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-black">Conexões WhatsApp com erro</h3>
          <div className="mt-4 space-y-2">
            {data.whatsappAlerts.length === 0 && <p className="text-sm text-stone-500">Nenhuma conexão WhatsApp com erro.</p>}
            {data.whatsappAlerts.map((connection) => (
              <article key={connection.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black">{connection.organizationName}</p><p className="text-xs text-stone-500">{connection.name}</p></div><span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-300">{connection.status}</span></div>
                {connection.lastError && <p className="mt-2 text-xs text-red-200">{connection.lastError}</p>}
                <p className="mt-2 text-[11px] text-stone-600">Atualizado {date(connection.updatedAt)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {error && <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200">{error}</div>}
      <p className="text-right text-[11px] text-stone-600">Atualizado em {date(data.generatedAt)}</p>
    </div>
  )
}
