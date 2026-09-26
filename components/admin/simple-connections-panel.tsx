"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, FileText, MessageCircle, MonitorSmartphone } from "lucide-react"
import type { StoreSettings } from "@/lib/types"
import { IntegrationsDashboard } from "@/components/admin/integrations-dashboard"
import { WhatsAppInbox } from "@/components/admin/whatsapp-inbox"

type Connection = { id: string; name: string; provider: string; status: string; settings: { templateName?: string; orderNotificationsEnabled?: boolean } }
type Overview = { connections: Connection[]; organization: { name: string }; runtime: { workerTokenConfigured: boolean; encryptionKeyConfigured: boolean } }

export function SimpleConnectionsPanel({ settings, organizationSlug, onSettingsChanged }: {
  settings: StoreSettings
  organizationSlug: string
  onSettingsChanged: (value: StoreSettings) => void
}) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [fiscalUrl, setFiscalUrl] = useState(settings.fiscalProviderUrl || "")
  const [desiredPhone, setDesiredPhone] = useState(settings.whatsappConnectionPhone || "")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/integrations", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar a conexão.")
      setOverview(data)
      setError("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível consultar a conexão.") }
  }, [])
  useEffect(() => { void load() }, [load])

  const whatsapp = overview?.connections.find(item => item.provider === "whatsapp_meta" && item.status === "active")
  const configured = Boolean(whatsapp)
  const workerReady = Boolean(overview?.runtime.workerTokenConfigured && overview?.runtime.encryptionKeyConfigured)
  const totemUrl = organizationSlug ? `/totem?loja=${encodeURIComponent(organizationSlug)}` : "/totem"

  async function saveSettings(patch: Partial<StoreSettings>, success: string) {
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.")
      onSettingsChanged(data.settings)
      setNotice(success)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar.") }
    finally { setBusy(false) }
  }

  async function setOrderAlerts(enabled: boolean) {
    if (!whatsapp) return
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/integrations/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_order_notifications", connectionId: whatsapp.id, enabled }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível alterar os avisos.")
      await load()
      setNotice(enabled ? "Avisos de pedidos ativados." : "Avisos de pedidos pausados.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar os avisos.") }
    finally { setBusy(false) }
  }

  async function saveFiscal() {
    const url = fiscalUrl.trim()
    if (url) {
      try { if (new URL(url).protocol !== "https:") throw new Error() } catch { setError("Informe o endereço HTTPS do emissor de notas."); return }
    }
    await saveSettings({ fiscalEnabled: Boolean(url), fiscalProviderUrl: url }, url ? "Acesso ao emissor salvo." : "Acesso ao emissor removido.")
  }

  async function savePhone() {
    const digits = desiredPhone.replace(/\D/g, "")
    if (digits && (digits.length < 10 || digits.length > 15)) { setError("Informe o número com DDD e código do país (ex.: +55 11 99999-9999)."); return }
    await saveSettings({ whatsappConnectionPhone: digits ? `+${digits}` : "" }, "Número registrado para a configuração da conexão.")
  }

  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h2 className="text-2xl font-black">Conectar serviços</h2><p className="text-sm text-slate-600">Escolha o que a sua loja usa. As configurações técnicas ficam com o responsável pela plataforma.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-black"><MessageCircle className="h-5 w-5" />WhatsApp e atendimento</h3>
      <p className="mt-2 text-sm text-slate-600">{configured ? `Conexão ativa: ${whatsapp!.name}.` : "Cadastre seu número. O responsável pela plataforma fará a conexão oficial com a Meta."}</p>
      {!configured && <div className="mt-4 flex flex-wrap items-end gap-2"><label className="flex-1 text-sm font-bold">Número do WhatsApp com DDD<input type="tel" value={desiredPhone} onChange={event => setDesiredPhone(event.target.value)} placeholder="+55 11 99999-9999" className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label><button type="button" disabled={busy} onClick={() => void savePhone()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar número</button></div>}
      {!configured && settings.whatsappConnectionPhone && <p className="mt-2 text-xs text-amber-800">Número registrado: {settings.whatsappConnectionPhone}. Aguardando conexão oficial; mensagens automáticas ainda não serão enviadas.</p>}
      {configured && !workerReady && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">A conexão existe, mas o envio automático ainda depende da configuração do servidor.</p>}
      {configured && workerReady && <p className="mt-2 text-xs text-slate-500">Para entregar as mensagens, a tarefa recorrente de envio precisa estar ativa no servidor.</p>}
      {configured && <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={busy || !workerReady} onClick={() => void setOrderAlerts(!whatsapp!.settings.orderNotificationsEnabled)} className="rounded-xl border p-4 text-left disabled:opacity-50"><strong className="block text-sm">Aviso ao finalizar pedido</strong><span className="text-xs text-slate-600">{whatsapp!.settings.orderNotificationsEnabled ? "Ativado — toque para pausar" : "Desativado — toque para ativar"}</span></button>
        <button type="button" disabled={busy || !workerReady} onClick={() => void saveSettings({ whatsappAiEnabled: !settings.whatsappAiEnabled, whatsappAutoServiceEnabled: false }, "Preferência da IA salva.")} className="rounded-xl border p-4 text-left disabled:opacity-50"><strong className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4" />Sugestões da IA</strong><span className="text-xs text-slate-600">{settings.whatsappAiEnabled ? "Ativadas — toque para pausar" : "Desativadas — toque para ativar"}</span></button>
        <button type="button" disabled={busy || !settings.whatsappAiEnabled || !workerReady} onClick={() => void saveSettings({ whatsappAutoServiceEnabled: !settings.whatsappAutoServiceEnabled }, "Atendimento automático atualizado.")} className="rounded-xl border p-4 text-left disabled:opacity-50"><strong className="block text-sm">Robô responde sozinho</strong><span className="text-xs text-slate-600">{settings.whatsappAutoServiceEnabled ? "Ativado — toque para pausar" : "Desativado — toque para ativar"}</span></button>
      </div>}
      <p className="mt-3 text-xs text-slate-500">O robô responde dúvidas em texto. Pedidos e pagamentos são finalizados no site da loja.</p>
    </section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-black"><MonitorSmartphone className="h-5 w-5" />Totem</h3><p className="mt-2 text-sm text-slate-600">Use o cardápio da loja em uma tela de autoatendimento.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void saveSettings({ totemEnabled: !settings.totemEnabled }, "Totem atualizado.")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{settings.totemEnabled ? "Desativar totem" : "Ativar totem"}</button>{settings.totemEnabled && <a href={totemUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-sm font-bold">Abrir totem</a>}</div></section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-black"><FileText className="h-5 w-5" />Notas fiscais</h3><p className="mt-2 text-sm text-slate-600">Se você já usa um emissor de notas, salve aqui o endereço de acesso. A emissão continua sendo feita nesse emissor.</p><label className="mt-4 block text-sm font-bold">Endereço do seu emissor<input type="url" value={fiscalUrl} onChange={event => setFiscalUrl(event.target.value)} placeholder="https://seu-emissor.com.br" className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void saveFiscal()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar acesso</button>{settings.fiscalEnabled && settings.fiscalProviderUrl?.startsWith("https://") && <a href={settings.fiscalProviderUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-sm font-bold">Abrir emissor</a>}</div><p className="mt-3 text-xs text-amber-800">Este acesso não emite nota automaticamente. A conexão para emissão pelo SaborFlow depende de um provedor fiscal escolhido e configurado pela plataforma.</p></section>

    {configured && <WhatsAppInbox />}
    <details className="rounded-2xl border bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Configuração técnica (responsável pela plataforma)</summary><p className="mt-3 text-xs text-slate-600">Tokens, webhook, modelo aprovado, diagnóstico e fila de envio.</p><button type="button" onClick={() => setAdvanced(true)} className="mt-3 rounded-xl border px-3 py-2 text-sm font-semibold">Mostrar campos técnicos</button>{advanced && <IntegrationsDashboard currentOrganizationName={overview?.organization.name || settings.storeName} embedded />}</details>
  </div>
}
