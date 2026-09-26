"use client"

import { useCallback, useEffect, useState } from "react"

type Agent = { id: string; name: string; active: boolean; lastSeenAt: string | null; printers: Array<{ name: string; port: string }> }

export function PrinterSetup({ selectedAgentId, selectedPrinterName, onSelected }: {
  selectedAgentId?: string
  selectedPrinterName?: string
  onSelected: (agentId: string, printerName: string) => void
}) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [token, setToken] = useState("")
  const [name, setName] = useState("Computador do caixa")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/print-agents", { cache: "no-store" })
      if (response.ok) setAgents((await response.json()).printAgents || [])
    } catch { /* A conexão pode estar temporariamente indisponível. */ }
  }, [])
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 12_000); return () => clearInterval(timer) }, [refresh])

  async function create() {
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/print-agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Falha ao preparar conexão.")
      setToken(result.agent.token)
      await refresh()
      await download(result.agent.token)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao preparar conexão.") }
    finally { setBusy(false) }
  }

  async function download(agentToken: string) {
    if (!agentToken) return
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/print-agent-installer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: agentToken }) })
      if (!response.ok) throw new Error((await response.json()).error || "Falha ao baixar.")
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a"); link.href = url; link.download = "CONECTAR-IMPRESSORA-SABORFLOW.cmd"; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setMessage("Arquivo baixado. No computador da impressora, abra o arquivo CONECTAR-IMPRESSORA-SABORFLOW.cmd. Mantenha a janela aberta para receber os pedidos.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao baixar.") }
    finally { setBusy(false) }
  }

  const connected = agents.filter(agent => agent.active)
  return <div className="mt-4 space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
    <strong className="block">Encontrar impressora USB ou Wi‑Fi</strong>
    <p>1. Instale a impressora USB ou Wi‑Fi no Windows. 2. Neste computador, clique em Conectar impressora e abra o arquivo baixado. 3. Escolha abaixo a impressora encontrada.</p>
    <div className="flex flex-wrap gap-2"><input value={name} onChange={event => setName(event.target.value)} placeholder="Nome deste computador" className="min-w-[180px] flex-1 rounded-xl border bg-white px-3 py-2" /><button type="button" disabled={busy || !name.trim()} onClick={() => void (token ? download(token) : create())} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Preparando..." : token ? "Baixar novamente" : "Conectar impressora"}</button></div>
    {connected.map(agent => { const online = Boolean(agent.lastSeenAt && Date.now() - new Date(agent.lastSeenAt).getTime() < 60_000); return <div key={agent.id} className="rounded-xl bg-white p-3"><p className="font-bold">{agent.name} · {online ? "Conectado" : "Aguardando computador"}</p>{online && <div className="mt-2 space-y-2">{agent.printers.map(printer => <button type="button" key={printer.name} onClick={() => onSelected(agent.id, printer.name)} className={`block w-full rounded-xl border px-3 py-2 text-left ${selectedAgentId === agent.id && selectedPrinterName === printer.name ? "border-emerald-500 bg-emerald-50 font-bold" : "border-slate-200"}`}>{printer.name} <span className="text-xs text-slate-500">({printer.port || "porta local"})</span></button>)}{!agent.printers.length && <p>O Windows ainda não encontrou impressoras. Confira a instalação USB/Wi‑Fi e atualize.</p>}</div>}</div> })}
    <button type="button" onClick={() => void refresh()} className="text-xs font-bold underline">Atualizar lista</button>
    {message && <p role="status">{message}</p>}
    <p className="text-xs">O computador precisa ficar ligado para imprimir. O arquivo de conexão contém uma chave privada desta empresa: não o compartilhe.</p>
  </div>
}
