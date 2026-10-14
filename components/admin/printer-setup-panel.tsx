"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { StoreSettings } from "@/lib/types"

type Agent = {
  id: string
  name: string
  active: boolean
  lastSeenAt: string | null
  printers: Array<{ name: string; port: string }>
}

type PrintDraft = Pick<StoreSettings, "autoPrintNewOrders" | "printerName" | "printCopies" | "printKitchenTicket" | "printCustomerTicket"> & {
  printerAgentId: string
  printerPaperWidthMm: 50 | 58 | 80
}
const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
const btnClass = "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50"

function fromSettings(settings: StoreSettings): PrintDraft {
  return {
    autoPrintNewOrders: Boolean(settings.autoPrintNewOrders),
    printerAgentId: settings.printerAgentId || "",
    printerName: settings.printerName || "",
    printerPaperWidthMm: settings.printerPaperWidthMm === 50 || settings.printerPaperWidthMm === 58 ? settings.printerPaperWidthMm : 80,
    printCopies: Math.max(1, Math.min(5, Number(settings.printCopies) || 1)),
    printKitchenTicket: Boolean(settings.printKitchenTicket),
    printCustomerTicket: Boolean(settings.printCustomerTicket),
  }
}

function isOnline(agent: Agent): boolean {
  if (!agent.active || !agent.lastSeenAt) return false
  const when = Date.parse(agent.lastSeenAt)
  return Number.isFinite(when) && Date.now() - when < 120000
}

export function PrinterSetupPanel({ settings, onSettingsChanged }: {
  settings: StoreSettings
  onSettingsChanged: (value: StoreSettings) => void
}) {
  const [draft, setDraft] = useState<PrintDraft>(() => fromSettings(settings))
  const [agents, setAgents] = useState<Agent[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [accessRestricted, setAccessRestricted] = useState(false)
  const [freshToken, setFreshToken] = useState("")
  const [agentLabel, setAgentLabel] = useState("Impressora da loja")
  useEffect(() => { setDraft(fromSettings(settings)) }, [settings])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/print-agents", { cache: "no-store" })
      if (response.status === 401 || response.status === 403) {
        setAccessRestricted(true)
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar os computadores.")
      setAccessRestricted(false)
      setAgents(Array.isArray(data.printAgents) ? data.printAgents : [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar os computadores.") }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const selectedAgent = agents.find(agent => agent.id === draft.printerAgentId)
  const available = useMemo(() => (selectedAgent?.printers || []).filter(item => item.name), [selectedAgent])
  const online = Boolean(selectedAgent && isOnline(selectedAgent))

  async function save() {
    setError(""); setNotice("")
    if (draft.autoPrintNewOrders) {
      if (!selectedAgent || !online) {
        setError("Para ativar o automático, conecte primeiro o computador da impressora e clique em Atualizar computadores.")
        return
      }
      if (!draft.printerName || !available.some(item => item.name === draft.printerName)) {
        setError("Escolha uma impressora encontrada no computador conectado.")
        return
      }
      if (!draft.printKitchenTicket && !draft.printCustomerTicket) {
        setError("Ative pelo menos um tipo de ticket.")
        return
      }
      if (!settings.autoPrintNewOrders && !window.confirm("Ativar impressão automática? Pedidos pendentes ainda não impressos recentemente podem entrar na fila. Confira a fila da loja antes de continuar.")) return
    }
    setBusy(true)
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, printCopies: Math.max(1, Math.min(5, draft.printCopies)) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a impressora.")
      onSettingsChanged(data.settings)
      setNotice(draft.autoPrintNewOrders ? "Configuração salva. Novos pedidos entrarão na fila do agente conectado." : "Impressão automática desativada. A impressão manual continua disponível.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar.") }
    finally { setBusy(false) }
  }

  async function createAgent() {
    setBusy(true); setError(""); setNotice(""); setFreshToken("")
    try {
      const response = await fetch("/api/admin/print-agents", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: agentLabel.trim().slice(0, 70) || "Computador da loja" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível criar a conexão.")
      setFreshToken(String(data.agent?.token || ""))
      if (data.agent?.id) setDraft(current => ({ ...current, printerAgentId: data.agent.id, printerName: "", autoPrintNewOrders: false }))
      await refresh()
      setNotice("A conexão foi criada. Baixe o conector no computador da loja e informe o token abaixo. Ele é exibido somente agora.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao criar conexão.") }
    finally { setBusy(false) }
  }

  function browserTest() {
    const popup = window.open("", "_blank", "width=450,height=560")
    if (!popup) { setError("O navegador bloqueou a janela de impressão."); return }
    const body = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Teste SaborFlow</title><style>@page{size:80mm auto;margin:3mm}body{font:14px Consolas,monospace;color:#111;padding:6mm}h2{text-align:center}</style></head><body><h2>SABORFLOW</h2><p>TESTE MANUAL DE IMPRESSAO</p><p>Se este ticket imprimiu, o navegador pode utilizar a impressora selecionada.</p><p>Isto NAO confirma o agente automatico.</p></body></html>`
    popup.document.open(); popup.document.write(body); popup.document.close(); popup.focus(); popup.print()
  }

  return <section data-sf-printer-wizard="v1" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-black text-slate-900">Impressora automática</h3><p className="mt-1 text-sm text-slate-600">Configure uma vez no computador da loja; depois os pedidos chegam automaticamente na impressora.</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${online ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
        {online ? "Computador conectado" : "Aguardando computador"}
      </span>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-sm font-semibold">Computador da impressora
          <select className={inputClass} value={draft.printerAgentId} onChange={event => setDraft(current => ({ ...current, printerAgentId: event.target.value, printerName: "", autoPrintNewOrders: false }))}>
            <option value="">Escolher computador</option>
            {agents.filter(item => item.active).map(agent => <option key={agent.id} value={agent.id}>{agent.name} — {isOnline(agent) ? "conectado" : "desconectado"}</option>)}
          </select>
        </label>
        <button type="button" className={btnClass} disabled={busy} onClick={() => { setError(""); void refresh() }}>Atualizar computadores</button>
      </div>
      {!accessRestricted && <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Conectar outro computador (Windows)</summary>
        <p className="mt-3 text-xs text-slate-600">Na máquina da impressora, instale o driver e use o conector do SaborFlow. O token é exclusivo desta empresa.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 text-sm font-semibold">Nome do computador
            <input className={inputClass} maxLength={70} value={agentLabel} onChange={event => setAgentLabel(event.target.value)} />
          </label>
          <button type="button" className={btnClass} onClick={() => void createAgent()} disabled={busy}>Criar conexão</button>
        </div>
        <a className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" href="/saborflow-impressao/CONECTOR-SABORFLOW-WINDOWS.zip" download>Baixar conector Windows</a>
        {freshToken && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">Token único — copie agora e guarde em segurança</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-2 text-xs">{freshToken}</code>
          <button type="button" className={`${btnClass} mt-2`} onClick={() => void navigator.clipboard.writeText(freshToken).then(() => setNotice("Token copiado.")).catch(() => setError("Selecione e copie o token manualmente."))}>Copiar token</button>
          <p className="mt-2 text-xs text-amber-900">Extraia o conector no Windows e execute CONECTAR-IMPRESSORA.cmd. Informe o endereço do SaborFlow e este token. Não envie o token pelo WhatsApp nem publique em arquivos.</p>
        </div>}
      </details>}
      {accessRestricted && <p className="text-sm text-amber-800">A listagem de computadores exige permissão de segurança da empresa. Solicite acesso ao proprietário.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">Impressora detectada pelo Windows
          <select className={inputClass} value={draft.printerName} onChange={event => setDraft(current => ({ ...current, printerName: event.target.value }))}>
            <option value="">Escolha a impressora</option>
            {draft.printerName && !available.some(item => item.name === draft.printerName) && <option value={draft.printerName}>{draft.printerName} (não localizada agora)</option>}
            {available.map(item => <option key={item.name} value={item.name}>{item.name}{item.port ? ` (${item.port})` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Largura do papel
          <select className={inputClass} value={draft.printerPaperWidthMm} onChange={event => setDraft(current => ({ ...current, printerPaperWidthMm: Number(event.target.value) as 50 | 58 | 80 }))}>
            <option value={50}>50 mm</option><option value={58}>58 mm</option><option value={80}>80 mm</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Cópias de cozinha
          <input className={inputClass} type="number" min={1} max={5} value={draft.printCopies} onChange={event => setDraft(current => ({ ...current, printCopies: Math.max(1, Math.min(5, Number(event.target.value) || 1)) }))} />
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.printKitchenTicket} onChange={event => setDraft(current => ({ ...current, printKitchenTicket: event.target.checked }))}/>Ticket da cozinha</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.printCustomerTicket} onChange={event => setDraft(current => ({ ...current, printCustomerTicket: event.target.checked }))}/>Ticket do cliente</label>
        </div>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold">
        <input type="checkbox" checked={draft.autoPrintNewOrders} onChange={event => setDraft(current => ({ ...current, autoPrintNewOrders: event.target.checked }))} />
        Imprimir automaticamente quando o pedido chegar (mesmo com pagamento pendente)
      </label>
      <p className="text-xs text-slate-600">O agente consulta a fila aproximadamente a cada 3 segundos. O computador precisa estar ligado, com internet e impressora acessível. Se estiver desconectado, os tickets aguardam na fila disponível do sistema.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" onClick={() => void save()}>{busy ? "Aguarde..." : "Salvar impressora"}</button>
        <button type="button" className={btnClass} onClick={browserTest}>Teste manual no navegador</button>
      </div>
    </div>
  </section>
}
