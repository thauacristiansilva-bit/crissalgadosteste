"use client"

import { useEffect, useState } from "react"

type Agent = { id: string; name: string; active: boolean; lastSeenAt: string | null }

export function PrinterSetup() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [name, setName] = useState("Caixa principal")
  const [token, setToken] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/admin/print-agents", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setAgents(data?.printAgents || [])).catch(() => {})
  }, [])

  async function connect() {
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/print-agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível conectar a impressora.")
      setToken(data.agent.token)
      setAgents((current) => [...current, data.agent])
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao criar conexão.") }
    finally { setBusy(false) }
  }

  const command = token && typeof window !== "undefined"
    ? `powershell -ExecutionPolicy Bypass -File .\\INICIAR-IMPRESSAO-AUTOMATICA.ps1 -ServerUrl "${window.location.origin}" -Token "${token}"`
    : ""

  return <details className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
    <summary className="cursor-pointer text-sm font-black text-blue-900">Conectar impressora no Windows · passo a passo</summary>
    <div className="mt-4 space-y-3 text-sm text-blue-950">
      <p><strong>1.</strong> Instale a impressora no Windows e preencha acima o nome dela, igual ao que aparece no Windows.</p>
      <p><strong>2.</strong> No computador da impressora, <a href="/api/admin/print-agent-script" className="font-bold underline">baixe o programa de impressão</a> e salve na área de trabalho.</p>
      <label className="block font-bold">3. Dê um nome à conexão<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-blue-200 bg-white px-3"/></label>
      <button type="button" onClick={() => void connect()} disabled={busy || !name.trim()} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Conectando..." : "Criar conexão"}</button>
      {command && <div className="rounded-xl bg-white p-3"><p className="font-bold">4. No PowerShell, na pasta onde baixou o arquivo, cole este comando:</p><code className="mt-2 block break-all text-xs">{command}</code><button type="button" onClick={() => navigator.clipboard.writeText(command)} className="mt-2 rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold">Copiar comando</button><p className="mt-2 text-xs text-red-700">Este código de conexão aparece apenas agora. Não compartilhe com outras pessoas.</p></div>}
      {agents.length > 0 && <div className="rounded-xl bg-white p-3"><strong>Conexões:</strong> {agents.filter((agent) => agent.active).map((agent) => `${agent.name}: ${agent.lastSeenAt ? "conectada" : "aguardando computador"}`).join(" · ") || "Nenhuma ativa"}</div>}
      {message && <p role="alert" className="text-red-700">{message}</p>}
    </div>
  </details>
}
