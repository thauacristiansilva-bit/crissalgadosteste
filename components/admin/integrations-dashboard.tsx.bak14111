"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react"

type Provider = "resend" | "twilio" | "whatsapp_meta" | "webhook"
type Channel = "email" | "sms" | "whatsapp" | "webhook"

type Connection = {
  id: string
  name: string
  channel: Channel
  provider: Provider
  status: "disabled" | "active" | "error"
  settings: Record<string, unknown>
  credentialConfigured: boolean
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  updatedAt: string
}

type Campaign = {
  id: string
  name: string
  channel: "manual" | "whatsapp" | "email" | "sms"
  status: "draft" | "ready" | "archived"
  audienceSegment: string
  scheduledFor: string | null
}

type QueueItem = {
  id: string
  campaignId: string | null
  connectionName: string
  channel: Channel
  recipient: string
  status: "queued" | "processing" | "sent" | "failed" | "cancelled"
  attempts: number
  maxAttempts: number
  providerStatus: string | null
  lastError: string | null
  nextAttemptAt: string
  sentAt: string | null
  createdAt: string
}

type Overview = {
  organization: { id: string; name: string }
  billing: {
    planCode: string | null
    subscriptionActive: boolean
    integrationsIncluded: boolean
    crmIncluded: boolean
  }
  runtime: {
    encryptionKeyConfigured: boolean
    workerTokenConfigured: boolean
    webhookAllowlistConfigured: boolean
  }
  connections: Connection[]
  campaigns: Campaign[]
  queue: QueueItem[]
  summary: {
    connections: number
    activeConnections: number
    queued: number
    sent: number
    failed: number
  }
}

const providerLabels: Record<Provider, string> = {
  resend: "Resend · E-mail",
  twilio: "Twilio · SMS",
  whatsapp_meta: "Meta · WhatsApp Cloud API",
  webhook: "Webhook HTTPS assinado",
}

const channelLabels: Record<Channel, string> = {
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
  webhook: "Webhook",
}

const statusLabels: Record<string, string> = {
  active: "Ativa",
  disabled: "Desativada",
  error: "Erro",
  queued: "Na fila",
  processing: "Processando",
  sent: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
}

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—"

function IconForChannel({ channel }: { channel: Channel }) {
  if (channel === "email") return <Mail className="h-4 w-4" />
  if (channel === "sms") return <Smartphone className="h-4 w-4" />
  if (channel === "whatsapp") return <MessageSquare className="h-4 w-4" />
  return <Link2 className="h-4 w-4" />
}

export function IntegrationsDashboard({ currentOrganizationName }: { currentOrganizationName: string }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [provider, setProvider] = useState<Provider>("resend")
  const [name, setName] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [from, setFrom] = useState("")
  const [accountSid, setAccountSid] = useState("")
  const [authToken, setAuthToken] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [phoneNumberId, setPhoneNumberId] = useState("")
  const [apiVersion, setApiVersion] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [languageCode, setLanguageCode] = useState("pt_BR")
  const [defaultCountryCode, setDefaultCountryCode] = useState("55")
  const [endpointUrl, setEndpointUrl] = useState("")
  const [signingSecret, setSigningSecret] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [connectionId, setConnectionId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const response = await fetch("/api/admin/integrations", { cache: "no-store" }).catch(() => null)
    if (!response) {
      setError("Não foi possível conectar ao servidor.")
      setLoading(false)
      return
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || "Não foi possível carregar as integrações.")
      setLoading(false)
      return
    }
    setData(payload as Overview)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const action = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    setError("")
    setMessage("")
    const response = await fetch("/api/admin/integrations/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!response) {
      setBusy(false)
      setError("Não foi possível conectar ao servidor.")
      return null
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setBusy(false)
      setError(payload.error || "Não foi possível concluir a ação.")
      return null
    }
    setBusy(false)
    await load()
    return payload
  }, [load])

  async function submitConnection(event: FormEvent) {
    event.preventDefault()
    const settings: Record<string, unknown> = {}
    const credentials: Record<string, unknown> = {}
    if (provider === "resend") {
      settings.from = from
      credentials.apiKey = apiKey
    } else if (provider === "twilio") {
      settings.from = from
      settings.defaultCountryCode = defaultCountryCode
      credentials.accountSid = accountSid
      credentials.authToken = authToken
    } else if (provider === "whatsapp_meta") {
      settings.apiVersion = apiVersion
      settings.defaultCountryCode = defaultCountryCode
      settings.templateName = templateName
      settings.languageCode = languageCode
      credentials.accessToken = accessToken
      credentials.phoneNumberId = phoneNumberId
    } else {
      settings.endpointUrl = endpointUrl
      credentials.signingSecret = signingSecret
    }
    const result = await action({
      action: "upsert_connection",
      name,
      provider,
      settings,
      credentials,
      enabled,
    })
    if (result) {
      setMessage("Conexão salva. As credenciais ficaram criptografadas e não retornam ao navegador.")
      setName("")
      setApiKey("")
      setFrom("")
      setAccountSid("")
      setAuthToken("")
      setAccessToken("")
      setPhoneNumberId("")
      setTemplateName("")
      setEndpointUrl("")
      setSigningSecret("")
      setEnabled(false)
    }
  }

  const readyCampaigns = useMemo(
    () => (data?.campaigns || []).filter((item) => item.status === "ready" && item.channel !== "manual"),
    [data],
  )
  const selectedCampaign = readyCampaigns.find((item) => item.id === campaignId) || null
  const compatibleConnections = useMemo(() => {
    const active = (data?.connections || []).filter((item) => item.status === "active")
    if (!selectedCampaign) return active
    return active.filter((item) => item.channel === "webhook" || item.channel === selectedCampaign.channel)
  }, [data, selectedCampaign])

  async function enqueueCampaign(event: FormEvent) {
    event.preventDefault()
    const response = await action({ action: "enqueue_campaign", campaignId, connectionId })
    if (response) {
      const result = response.result as { queued?: number; duplicates?: number; skipped?: number } | undefined
      setMessage(`Campanha colocada na fila: ${result?.queued || 0} novo(s), ${result?.duplicates || 0} duplicado(s), ${result?.skipped || 0} sem contato válido.`)
    }
  }

  if (loading && !data) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fff8ef]"><Loader2 className="h-8 w-8 animate-spin text-amber-700" /></div>
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-amber-800"><ArrowLeft className="h-4 w-4" />Voltar ao painel</a>
            <h1 className="mt-2 text-3xl font-black">Integrações</h1>
            <p className="mt-1 text-sm text-slate-600">{currentOrganizationName} · conexões externas, fila e webhooks controlados pelo servidor.</p>
          </div>
          <button onClick={() => void load()} disabled={busy || loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-black text-amber-900 disabled:opacity-50"><RefreshCcw className="h-4 w-4" />Atualizar</button>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}

        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Conexões", data.summary.connections],
                ["Ativas", data.summary.activeConnections],
                ["Na fila", data.summary.queued],
                ["Enviados", data.summary.sent],
                ["Falhas", data.summary.failed],
              ].map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}
            </section>

            <section className="grid gap-3 lg:grid-cols-3">
              <div className={`rounded-2xl border p-4 ${data.runtime.encryptionKeyConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
                <p className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4" />Criptografia de credenciais</p>
                <p className="mt-1 text-sm">{data.runtime.encryptionKeyConfigured ? "INTEGRATION_ENCRYPTION_KEY configurada." : "Configure INTEGRATION_ENCRYPTION_KEY para salvar/usar segredos."}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${data.runtime.workerTokenConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
                <p className="flex items-center gap-2 font-black"><Send className="h-4 w-4" />Worker de saída</p>
                <p className="mt-1 text-sm">{data.runtime.workerTokenConfigured ? "Token do worker configurado." : "Configure INTEGRATION_WORKER_TOKEN; o navegador nunca executa o disparo externo."}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${data.runtime.webhookAllowlistConfigured ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <p className="flex items-center gap-2 font-black"><Link2 className="h-4 w-4" />Allowlist de webhook</p>
                <p className="mt-1 text-sm">{data.runtime.webhookAllowlistConfigured ? "Hosts autorizados configurados." : "Necessária somente para webhooks de saída: INTEGRATION_WEBHOOK_ALLOWED_HOSTS."}</p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <form onSubmit={submitConnection} className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Nova conexão</h2>
                <p className="mt-1 text-sm text-slate-500">Segredos são enviados ao backend, criptografados em AES-256-GCM e nunca reapresentados.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">Nome<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="Ex.: E-mail comercial" required /></label>
                  <label className="text-sm font-bold">Provedor<select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal">{Object.entries(providerLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>

                  {provider === "resend" && <><label className="text-sm font-bold">Remetente<input value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="Loja <contato@dominio.com>" required /></label><label className="text-sm font-bold">API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label></>}
                  {provider === "twilio" && <><label className="text-sm font-bold">Número remetente<input value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="+5511..." required /></label><label className="text-sm font-bold">Código do país<input value={defaultCountryCode} onChange={(e) => setDefaultCountryCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label><label className="text-sm font-bold">Account SID<input type="password" value={accountSid} onChange={(e) => setAccountSid(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label><label className="text-sm font-bold">Auth Token<input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label></>}
                  {provider === "whatsapp_meta" && <><label className="text-sm font-bold">Graph API version<input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="vNN.N" required /></label><label className="text-sm font-bold">Código do país<input value={defaultCountryCode} onChange={(e) => setDefaultCountryCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label><label className="text-sm font-bold">Template aprovado<input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="nome_do_template" required /></label><label className="text-sm font-bold">Idioma do template<input value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="pt_BR" required /></label><label className="text-sm font-bold">Phone Number ID<input type="password" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label><label className="text-sm font-bold">Access Token<input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" required /></label><p className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">A mensagem da campanha é enviada como o primeiro parâmetro do corpo do template. Use um template aprovado com um parâmetro de texto no corpo.</p></>}
                  {provider === "webhook" && <><label className="text-sm font-bold sm:col-span-2">Endpoint HTTPS<input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" placeholder="https://integracao.exemplo.com/saborflow" required /></label><label className="text-sm font-bold sm:col-span-2">Segredo HMAC<input type="password" value={signingSecret} onChange={(e) => setSigningSecret(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" minLength={16} required /></label></>}
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Ativar imediatamente</label>
                <button disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Salvar conexão</button>
              </form>

              <div className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Conexões cadastradas</h2>
                <div className="mt-4 space-y-3">
                  {!data.connections.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma conexão cadastrada.</p>}
                  {data.connections.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-black"><IconForChannel channel={item.channel} />{item.name}</p><p className="mt-1 text-xs text-slate-500">{providerLabels[item.provider]} · {statusLabels[item.status]}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : item.status === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{statusLabels[item.status]}</span></div>
                    {item.lastSuccessAt && <p className="mt-2 text-xs text-emerald-700">Último sucesso: {dateTime(item.lastSuccessAt)}</p>}
                    {item.lastError && <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs text-red-700">{item.lastError}</p>}
                    <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void action({ action: "set_connection_status", connectionId: item.id, enabled: item.status !== "active" })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">{item.status === "active" ? "Desativar" : "Ativar"}</button><button disabled={busy} onClick={() => { if (window.confirm("Excluir esta conexão?")) void action({ action: "delete_connection", connectionId: item.id }) }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-700"><Trash2 className="h-3.5 w-3.5" />Excluir</button></div>
                  </article>)}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">Campanhas do CRM → fila de integrações</h2>
              <p className="mt-1 text-sm text-slate-500">Somente clientes com consentimento de marketing entram na audiência. A ação abaixo apenas cria itens idempotentes na fila; quem chama os provedores é o worker autenticado.</p>
              <form onSubmit={enqueueCampaign} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setConnectionId("") }} className="rounded-xl border border-slate-200 px-3 py-2" required><option value="">Selecione a campanha pronta</option>{readyCampaigns.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.channel}</option>)}</select>
                <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required><option value="">Selecione a conexão ativa</option>{compatibleConnections.map((item) => <option key={item.id} value={item.id}>{item.name} · {channelLabels[item.channel]}</option>)}</select>
                <button disabled={busy || !campaignId || !connectionId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />Colocar na fila</button>
              </form>
              {!data.billing.crmIncluded && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800"><AlertTriangle className="mr-1 inline h-4 w-4" />O plano atual não inclui CRM/fidelidade; campanhas externas ficam indisponíveis.</p>}
            </section>

            <section className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Fila e tentativas</h2><p className="text-sm text-slate-500">Últimos 100 itens. Falhas transitórias usam retry com backoff; após o limite o item fica como falha.</p></div><code className="hidden rounded-lg bg-slate-100 px-2 py-1 text-xs sm:block">POST /api/internal/integrations/process</code></div>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-2">Conexão</th><th>Canal</th><th>Destinatário</th><th>Status</th><th>Tentativas</th><th>Próxima/Enviado</th><th></th></tr></thead><tbody>{data.queue.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 font-bold">{item.connectionName}</td><td>{channelLabels[item.channel]}</td><td className="max-w-[220px] truncate">{item.recipient}</td><td><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${item.status === "sent" ? "bg-emerald-50 text-emerald-700" : item.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{item.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{statusLabels[item.status]}</span>{item.lastError && <p className="mt-1 max-w-[260px] truncate text-[11px] text-red-600" title={item.lastError}>{item.lastError}</p>}</td><td>{item.attempts}/{item.maxAttempts}</td><td>{dateTime(item.sentAt || item.nextAttemptAt)}</td><td>{item.status === "queued" && <button onClick={() => void action({ action: "cancel_job", jobId: item.id })} disabled={busy} className="text-xs font-black text-red-700">Cancelar</button>}</td></tr>)}{!data.queue.length && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Nenhum item na fila.</td></tr>}</tbody></table></div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
              <h2 className="font-black">Fronteiras da Fase 23</h2>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2"><p>• O navegador cadastra e enfileira; não possui credencial do provedor e não executa o envio.</p><p>• O worker exige INTEGRATION_WORKER_TOKEN.</p><p>• Webhooks genéricos usam HMAC SHA-256 e idempotência por evento.</p><p>• Webhook de saída exige HTTPS e host presente na allowlist do ambiente.</p><p>• Ambientes demo continuam proibidos de produzir efeitos externos reais.</p><p>• RLS permanece preparado e desligado até a Fase 24.</p></div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
