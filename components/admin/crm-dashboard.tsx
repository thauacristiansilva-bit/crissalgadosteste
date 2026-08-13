"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  Gift,
  HeartHandshake,
  Megaphone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  WalletCards,
} from "lucide-react"

type Segment = "all" | "new" | "repeat" | "frequent" | "elite" | "active" | "sleeping" | "inactive" | "never"
type Channel = "manual" | "whatsapp" | "email" | "sms"

type Customer = {
  key: string
  accountId: number | null
  name: string
  phone: string
  email: string
  orders: number
  totalSpent: number
  lastOrderAt: string
  loyaltyPoints: number
  segment: "new" | "repeat" | "frequent" | "elite"
  lifecycle: "never" | "active" | "sleeping" | "inactive"
  tags: string[]
  notes: string
  marketingOptIn: boolean
  consentSource: string | null
  consentAt: string | null
  lastContactAt: string | null
}

type Campaign = {
  id: string
  name: string
  channel: Channel
  status: "draft" | "ready" | "archived"
  audienceSegment: Segment
  message: string
  couponCode: string
  scheduledFor: string | null
  audienceCount: number
  createdAt: string
  updatedAt: string
}

type LedgerItem = {
  id: string
  customerId: number
  customerName: string
  orderId: number | null
  kind: "opening" | "earn" | "redeem" | "adjust" | "reversal"
  points: number
  balanceAfter: number
  reason: string
  createdAt: string
}

type CrmData = {
  organization: { id: string; name: string }
  billing: { planCode: string | null; subscriptionActive: boolean; loyaltyIncluded: boolean }
  loyalty: {
    enabled: boolean
    pointsPerReal: number
    rewardPoints: number
    rewardText: string
    outstandingPoints: number
    rewardEligibleCustomers: number
  }
  stats: {
    customers: number
    registeredAccounts: number
    marketingOptIn: number
    activeCustomers: number
    sleepingCustomers: number
    inactiveCustomers: number
    campaignsDraft: number
    campaignsReady: number
  }
  customers: Customer[]
  campaigns: Campaign[]
  ledger: LedgerItem[]
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

const segmentLabels: Record<Segment, string> = {
  all: "Todos com consentimento",
  new: "Novos",
  repeat: "Repetidos",
  frequent: "Frequentes",
  elite: "Elite",
  active: "Ativos (até 30 dias)",
  sleeping: "Adormecidos (31–90 dias)",
  inactive: "Inativos (+90 dias)",
  never: "Cadastrados sem pedido",
}

const channelLabels: Record<Channel, string> = {
  manual: "Ação manual",
  whatsapp: "WhatsApp",
  email: "E-mail",
  sms: "SMS",
}

const statusLabels = { draft: "Rascunho", ready: "Pronta", archived: "Arquivada" }
const ledgerLabels = {
  opening: "Saldo inicial",
  earn: "Crédito por pedido",
  redeem: "Resgate",
  adjust: "Ajuste manual",
  reversal: "Estorno",
}

async function json(response: Response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a operação.")
  return payload
}

export function CrmDashboard({ currentOrganizationName }: { currentOrganizationName: string }) {
  const [data, setData] = useState<CrmData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState({ tags: "", notes: "", marketingOptIn: false })
  const [adjustment, setAdjustment] = useState({ points: "", reason: "" })
  const [loyaltyDraft, setLoyaltyDraft] = useState({ enabled: false, pointsPerReal: "1", rewardPoints: "100", rewardText: "" })
  const [campaignDraft, setCampaignDraft] = useState({
    name: "",
    channel: "whatsapp" as Channel,
    audienceSegment: "active" as Segment,
    message: "",
    couponCode: "",
    scheduledFor: "",
  })

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const payload = await json(await fetch("/api/admin/crm", { cache: "no-store" })) as CrmData
      setData(payload)
      setLoyaltyDraft({
        enabled: payload.loyalty.enabled,
        pointsPerReal: String(payload.loyalty.pointsPerReal),
        rewardPoints: String(payload.loyalty.rewardPoints),
        rewardText: payload.loyalty.rewardText,
      })
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar CRM.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const selected = useMemo(
    () => data?.customers.find((customer) => customer.key === selectedKey) || null,
    [data, selectedKey],
  )

  useEffect(() => {
    if (!selected) return
    setProfileDraft({
      tags: selected.tags.join(", "),
      notes: selected.notes,
      marketingOptIn: selected.marketingOptIn,
    })
    setAdjustment({ points: "", reason: "" })
  }, [selected?.key])

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR")
    if (!data || !needle) return data?.customers || []
    return data.customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, ...customer.tags]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(needle),
    )
  }, [data, search])

  async function action(body: Record<string, unknown>, success: string) {
    setMessage("")
    try {
      await json(await fetch("/api/admin/crm/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }))
      setMessage(success)
      await load(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.")
    }
  }

  async function saveLoyalty() {
    setMessage("")
    try {
      await json(await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyaltyEnabled: loyaltyDraft.enabled,
          loyaltyPointsPerReal: Math.max(0, Number(loyaltyDraft.pointsPerReal || 0)),
          loyaltyRewardPoints: Math.max(1, Math.trunc(Number(loyaltyDraft.rewardPoints || 1))),
          loyaltyRewardText: loyaltyDraft.rewardText.trim(),
        }),
      }))
      setMessage("Programa de fidelidade atualizado.")
      await load(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar fidelidade.")
    }
  }

  async function saveProfile() {
    if (!selected) return
    await action({
      action: "update_customer",
      customerKey: selected.key,
      accountId: selected.accountId,
      tags: profileDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      notes: profileDraft.notes,
      marketingOptIn: profileDraft.marketingOptIn,
    }, "Perfil CRM atualizado.")
  }

  async function markContacted() {
    if (!selected) return
    await action({
      action: "update_customer",
      customerKey: selected.key,
      accountId: selected.accountId,
      tags: profileDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      notes: profileDraft.notes,
      marketingOptIn: profileDraft.marketingOptIn,
      markContacted: true,
    }, "Contato registrado no CRM.")
  }

  async function adjustPoints() {
    if (!selected?.accountId) return
    await action({
      action: "adjust_loyalty",
      accountId: selected.accountId,
      points: Math.trunc(Number(adjustment.points)),
      reason: adjustment.reason,
    }, "Saldo de pontos atualizado.")
    setAdjustment({ points: "", reason: "" })
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault()
    await action({
      action: "create_campaign",
      ...campaignDraft,
      scheduledFor: campaignDraft.scheduledFor ? new Date(campaignDraft.scheduledFor).toISOString() : null,
    }, "Campanha salva como rascunho.")
    setCampaignDraft({ name: "", channel: "whatsapp", audienceSegment: "active", message: "", couponCode: "", scheduledFor: "" })
  }

  if (loading && !data) {
    return <main className="min-h-screen bg-[#fff8ef] p-6"><div className="mx-auto max-w-7xl rounded-3xl border border-[#f0d0aa] bg-white p-8 font-bold text-gray-600">Carregando CRM e fidelidade…</div></main>
  }

  if (!data) {
    return <main className="min-h-screen bg-[#fff8ef] p-6"><div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-white p-8"><h1 className="text-xl font-black">CRM indisponível</h1><p className="mt-2 text-sm text-red-700">{message || "Execute a migration da FASE 21 e tente novamente."}</p><a href="/admin" className="mt-5 inline-flex rounded-xl bg-[#2f1c13] px-4 py-2 text-sm font-black text-white">Voltar ao painel</a></div></main>
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-5 text-gray-950 sm:px-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <a href="/admin" className="mt-1 rounded-xl border border-[#f0d0aa] p-2 text-[#4b2c1d] hover:bg-[#fff8ef]" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></a>
            <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-[#d96d00]">Crescimento</p><h1 className="mt-1 text-2xl font-black">CRM, fidelidade e marketing</h1><p className="mt-1 text-sm text-gray-500">{currentOrganizationName} · relacionamento por tenant</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Plano: {data.billing.planCode || "—"}</span>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black"><RefreshCcw className="h-4 w-4" />Atualizar</button>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Clientes", data.stats.customers, Users],
            ["Contas cadastradas", data.stats.registeredAccounts, ShieldCheck],
            ["Consentiram marketing", data.stats.marketingOptIn, CheckCircle2],
            ["Pontos em circulação", data.loyalty.outstandingPoints, WalletCards],
            ["Elegíveis a prêmio", data.loyalty.rewardEligibleCustomers, Gift],
            ["Campanhas prontas", data.stats.campaignsReady, Megaphone],
          ].map(([label, value, Icon]) => {
            const Component = Icon as typeof Users
            return <article key={String(label)} className="rounded-2xl border border-[#f0d0aa] bg-white p-4 shadow-sm"><Component className="h-5 w-5 text-[#d96d00]" /><p className="mt-3 text-2xl font-black">{String(value)}</p><p className="mt-1 text-xs font-semibold text-gray-500">{String(label)}</p></article>
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <article className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-violet-700" /><h2 className="font-black">Programa de fidelidade</h2></div>
            <p className="mt-2 text-sm text-gray-500">A partir desta fase os pontos são creditados quando o pedido é concluído, não no checkout.</p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3"><span><strong className="block text-sm">Ativar fidelidade</strong><small className="text-gray-500">Somente clientes com conta acumulam saldo.</small></span><input type="checkbox" checked={loyaltyDraft.enabled} onChange={(e) => setLoyaltyDraft({ ...loyaltyDraft, enabled: e.target.checked })} className="h-5 w-5" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-600">Pontos por R$ 1<input type="number" min="0" step="0.1" value={loyaltyDraft.pointsPerReal} onChange={(e) => setLoyaltyDraft({ ...loyaltyDraft, pointsPerReal: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label className="text-xs font-bold text-gray-600">Pontos para resgate<input type="number" min="1" value={loyaltyDraft.rewardPoints} onChange={(e) => setLoyaltyDraft({ ...loyaltyDraft, rewardPoints: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label></div>
              <label className="text-xs font-bold text-gray-600">Benefício<textarea rows={3} value={loyaltyDraft.rewardText} onChange={(e) => setLoyaltyDraft({ ...loyaltyDraft, rewardText: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Ex.: Troque 100 pontos por um benefício definido pela loja." /></label>
              <button onClick={() => void saveLoyalty()} className="h-10 w-full rounded-xl bg-violet-700 text-sm font-black text-white">Salvar fidelidade</button>
            </div>
          </article>

          <article className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-[#d96d00]" /><h2 className="font-black">Base de clientes CRM</h2></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" className="h-9 rounded-xl border border-gray-200 pl-9 pr-3 text-sm" /></div></div>
            <div className="mt-4 max-h-[430px] overflow-auto rounded-2xl border border-gray-100">
              <table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Segmento</th><th className="px-3 py-2">Pedidos</th><th className="px-3 py-2">Gasto</th><th className="px-3 py-2">Pontos</th><th className="px-3 py-2">Marketing</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.key} onClick={() => setSelectedKey(customer.key)} className={`cursor-pointer border-t border-gray-100 hover:bg-orange-50/50 ${selectedKey === customer.key ? "bg-orange-50" : ""}`}><td className="px-3 py-3"><p className="font-black">{customer.name}</p><p className="text-xs text-gray-400">{customer.phone || customer.email || "Sem contato"}</p></td><td className="px-3 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold">{customer.segment} · {customer.lifecycle}</span></td><td className="px-3 py-3 font-bold">{customer.orders}</td><td className="px-3 py-3 font-bold">{money.format(customer.totalSpent)}</td><td className="px-3 py-3 font-black text-violet-700">{customer.loyaltyPoints}</td><td className="px-3 py-3">{customer.marketingOptIn ? <span className="font-black text-emerald-700">Consentiu</span> : <span className="text-gray-400">Sem consentimento</span>}</td></tr>)}</tbody></table>
            </div>
          </article>
        </section>

        {selected && (
          <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <article className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Tags className="h-5 w-5 text-blue-700" /><h2 className="font-black">Perfil CRM · {selected.name}</h2></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-gray-600">Tags<input value={profileDraft.tags} onChange={(e) => setProfileDraft({ ...profileDraft, tags: e.target.value })} placeholder="vip, aniversário, empresa" className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2"><span><strong className="block text-xs">Consentimento para marketing</strong><small className="text-[11px] text-gray-500">Marque somente quando houver consentimento registrado.</small></span><input type="checkbox" checked={profileDraft.marketingOptIn} onChange={(e) => setProfileDraft({ ...profileDraft, marketingOptIn: e.target.checked })} className="h-5 w-5" /></label></div>
              <label className="mt-3 block text-xs font-bold text-gray-600">Notas internas<textarea value={profileDraft.notes} onChange={(e) => setProfileDraft({ ...profileDraft, notes: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Preferências, histórico de atendimento, observações comerciais…" /></label>
              <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void saveProfile()} className="rounded-xl bg-[#2f1c13] px-4 py-2 text-xs font-black text-white">Salvar perfil</button><button onClick={() => void markContacted()} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black">Registrar contato agora</button>{selected.lastContactAt && <span className="self-center text-xs text-gray-400">Último contato: {dateTime.format(new Date(selected.lastContactAt))}</span>}</div>
            </article>

            <article className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><BadgePercent className="h-5 w-5 text-violet-700" /><h2 className="font-black">Saldo de fidelidade</h2></div>
              <p className="mt-3 text-4xl font-black text-violet-800">{selected.loyaltyPoints} <span className="text-base">pts</span></p>
              {!selected.accountId ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Este cliente ainda não possui conta cadastrada; ajustes e resgates exigem uma conta do cliente.</p> : <div className="mt-4 space-y-3"><div className="grid grid-cols-[110px_1fr] gap-2"><input type="number" value={adjustment.points} onChange={(e) => setAdjustment({ ...adjustment, points: e.target.value })} placeholder="+10 / -10" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" /><input value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })} placeholder="Motivo do ajuste" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" /></div><button onClick={() => void adjustPoints()} className="h-10 w-full rounded-xl border border-violet-200 bg-violet-50 text-sm font-black text-violet-800">Aplicar ajuste auditável</button><button disabled={!data.loyalty.enabled || selected.loyaltyPoints < data.loyalty.rewardPoints} onClick={() => void action({ action: "redeem_loyalty", accountId: selected.accountId }, "Benefício resgatado e pontos debitados.")} className="h-10 w-full rounded-xl bg-violet-700 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Resgatar benefício ({data.loyalty.rewardPoints} pts)</button></div>}
            </article>
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <article className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-700" /><h2 className="font-black">Planejar campanha</h2></div>
            <p className="mt-2 text-xs text-gray-500">A FASE 21 prepara público e conteúdo. Disparo automático externo permanece bloqueado até as integrações da FASE 23.</p>
            <form onSubmit={createCampaign} className="mt-4 space-y-3"><input required value={campaignDraft.name} onChange={(e) => setCampaignDraft({ ...campaignDraft, name: e.target.value })} placeholder="Nome da campanha" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><select value={campaignDraft.channel} onChange={(e) => setCampaignDraft({ ...campaignDraft, channel: e.target.value as Channel })} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={campaignDraft.audienceSegment} onChange={(e) => setCampaignDraft({ ...campaignDraft, audienceSegment: e.target.value as Segment })} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{Object.entries(segmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><textarea required rows={5} value={campaignDraft.message} onChange={(e) => setCampaignDraft({ ...campaignDraft, message: e.target.value })} placeholder="Mensagem da campanha" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><input value={campaignDraft.couponCode} onChange={(e) => setCampaignDraft({ ...campaignDraft, couponCode: e.target.value.toUpperCase() })} placeholder="Cupom opcional" className="h-10 rounded-xl border border-gray-200 px-3 text-sm uppercase" /><input type="datetime-local" value={campaignDraft.scheduledFor} onChange={(e) => setCampaignDraft({ ...campaignDraft, scheduledFor: e.target.value })} className="h-10 rounded-xl border border-gray-200 px-3 text-sm" /></div><button className="h-10 w-full rounded-xl bg-emerald-700 text-sm font-black text-white">Salvar campanha</button></form>
          </article>

          <article className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-[#d96d00]" /><h2 className="font-black">Campanhas</h2></div>
            <div className="mt-4 space-y-3">{data.campaigns.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Nenhuma campanha criada.</p>}{data.campaigns.map((campaign) => <div key={campaign.id} className="rounded-2xl border border-gray-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black">{campaign.name}</p><p className="mt-1 text-xs text-gray-500">{channelLabels[campaign.channel]} · {segmentLabels[campaign.audienceSegment]} · {campaign.audienceCount} cliente(s) com consentimento</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black">{statusLabels[campaign.status]}</span></div><p className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{campaign.message}</p><div className="mt-3 flex flex-wrap gap-2">{campaign.status !== "ready" && campaign.status !== "archived" && <button onClick={() => void action({ action: "set_campaign_status", campaignId: campaign.id, status: "ready" }, "Campanha marcada como pronta.")} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">Marcar pronta</button>}{campaign.status !== "archived" && <button onClick={() => void action({ action: "set_campaign_status", campaignId: campaign.id, status: "archived" }, "Campanha arquivada.")} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-gray-700">Arquivar</button>}{campaign.status === "archived" && <button onClick={() => void action({ action: "set_campaign_status", campaignId: campaign.id, status: "draft" }, "Campanha restaurada como rascunho.")} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-gray-700">Restaurar</button>}</div></div>)}</div>
          </article>
        </section>

        <section className="rounded-3xl border border-[#f0d0aa] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-violet-700" /><h2 className="font-black">Extrato recente de fidelidade</h2></div>
          <div className="mt-4 overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Movimento</th><th className="px-3 py-2">Pontos</th><th className="px-3 py-2">Saldo</th><th className="px-3 py-2">Motivo</th></tr></thead><tbody>{data.ledger.map((item) => <tr key={item.id} className="border-t border-gray-100"><td className="px-3 py-3 text-xs text-gray-500">{dateTime.format(new Date(item.createdAt))}</td><td className="px-3 py-3 font-bold">{item.customerName}</td><td className="px-3 py-3">{ledgerLabels[item.kind]}</td><td className={`px-3 py-3 font-black ${item.points >= 0 ? "text-emerald-700" : "text-red-700"}`}>{item.points > 0 ? "+" : ""}{item.points}</td><td className="px-3 py-3 font-bold">{item.balanceAfter}</td><td className="px-3 py-3 text-gray-500">{item.reason}</td></tr>)}</tbody></table>{data.ledger.length === 0 && <p className="p-4 text-sm text-gray-500">O extrato será preenchido conforme houver créditos, resgates e ajustes.</p>}</div>
        </section>
      </div>
    </main>
  )
}
