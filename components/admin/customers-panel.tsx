"use client"

import { Download, MessageCircle, Plus, Search, Upload, Users, X } from "lucide-react"
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react"
import type { CustomerSummary } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
const segmentLabel: Record<CustomerSummary["segment"], string> = { new: "Novo", repeat: "Comprador repetido", frequent: "Comprador frequente", elite: "Comprador Elite" }
const lifecycleLabel: Record<CustomerSummary["lifecycle"], string> = { never: "Nunca comprou", active: "Ativo", sleeping: "Dormindo", inactive: "Inativo" }

function csvEscape(value: string | number) { const text = String(value ?? ""); return `"${text.replace(/"/g, '""')}"` }
function downloadCsv(customers: CustomerSummary[]) {
  const header = ["Nome", "Telefone", "CPF final", "Pontos", "Pedidos", "Total gasto", "Segmento", "Status", "Último pedido"]
  const rows = customers.map((c) => [c.name, c.phone, c.cpfLast4 || "", c.loyaltyPoints, c.orders, c.totalSpent.toFixed(2), segmentLabel[c.segment], lifecycleLabel[c.lifecycle], c.lastOrderAt])
  const content = "\ufeff" + [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a"); a.href = url; a.download = `clientes-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
}

function splitCsvLine(line: string, separator: string) {
  const values: string[] = []; let current = ""; let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i += 1 } else quoted = !quoted }
    else if (char === separator && !quoted) { values.push(current.trim()); current = "" }
    else current += char
  }
  values.push(current.trim()); return values
}

export function CustomersPanel({ customers, onCustomersChanged }: { customers: CustomerSummary[]; onCustomersChanged: (customers: CustomerSummary[]) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [draft, setDraft] = useState({ name: "", phone: "", cpf: "", pin: "", email: "" })
  const importRef = useRef<HTMLInputElement>(null)
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return customers.filter((customer) => (!query || customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query)) && (filter === "all" || customer.segment === filter || customer.lifecycle === filter)) }, [customers, search, filter])

  async function createCustomer(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
      const data = await response.json(); if (!response.ok) throw new Error(data.errors?.[0]?.error || data.error || "Não foi possível cadastrar.")
      onCustomersChanged(data.customers); setDraft({ name: "", phone: "", cpf: "", pin: "", email: "" }); setModal(false); setMessage("Cliente cadastrado.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro no cadastro.") } finally { setBusy(false) }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return
    setBusy(true); setMessage("")
    try {
      const text = await file.text(); const lines = text.split(/\r?\n/).filter((line) => line.trim())
      if (lines.length < 2) throw new Error("CSV sem linhas de clientes.")
      const separator = lines[0].includes(";") ? ";" : ","
      const headers = splitCsvLine(lines[0], separator).map((item) => item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim())
      const index = (names: string[]) => headers.findIndex((header) => names.includes(header))
      const idx = { name: index(["nome","name"]), phone: index(["telefone","phone","celular"]), cpf: index(["cpf"]), pin: index(["pin","senha"]), email: index(["email","e-mail"]) }
      if (idx.name < 0 || idx.phone < 0 || idx.cpf < 0 || idx.pin < 0) throw new Error("O CSV precisa ter as colunas Nome, Telefone, CPF e PIN.")
      const parsed = lines.slice(1).map((line) => { const cols = splitCsvLine(line, separator); return { name: cols[idx.name] || "", phone: cols[idx.phone] || "", cpf: cols[idx.cpf] || "", pin: cols[idx.pin] || "", email: idx.email >= 0 ? cols[idx.email] || "" : "" } }).filter((item) => item.name || item.phone || item.cpf)
      const response = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers: parsed }) })
      const data = await response.json(); if (!data.customers) throw new Error(data.error || "Falha ao importar.")
      onCustomersChanged(data.customers); setMessage(`${data.created?.length || 0} cliente(s) importado(s).${data.errors?.length ? ` ${data.errors.length} linha(s) com erro.` : ""}`)
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao importar CSV.") } finally { setBusy(false) }
  }

  return <>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-black">Clientes</h2><p className="text-sm text-gray-500">Contas por CPF, histórico, pontos e segmentação automática.</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" className="h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm"/></label><button onClick={() => downloadCsv(filtered)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-black"><Download className="h-4 w-4"/>Exportar CSV</button><button onClick={() => importRef.current?.click()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-black"><Upload className="h-4 w-4"/>Importar</button><input ref={importRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden"/><button onClick={() => setModal(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 text-xs font-black text-white"><Plus className="h-4 w-4"/>Novo cliente</button></div></div>
      {message && <div className="border-b border-blue-100 bg-blue-50 px-5 py-2.5 text-xs font-bold text-blue-800">{message}</div>}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3">{[["all","Todos"],["elite","Comprador Elite"],["frequent","Frequente"],["repeat","Repetido"],["active","Ativo"],["sleeping","Dormindo"],["inactive","Inativo"]].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-black ${filter === value ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600"}`}>{label}</button>)}<span className="ml-auto text-xs font-bold text-gray-400">Total: {customers.length}</span></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">CPF</th><th className="px-5 py-3">Pontos</th><th className="px-5 py-3">Pedidos</th><th className="px-5 py-3">Total gasto</th><th className="px-5 py-3">Segmento</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Contato</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((customer) => <tr key={customer.key}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 font-black text-blue-700">{customer.name.slice(0,1).toUpperCase()}</div><div><p className="font-bold text-gray-900">{customer.name}</p><p className="text-xs text-gray-500">{customer.phone}</p><p className="text-[10px] text-gray-400">Último: {date(customer.lastOrderAt)}</p></div></div></td><td className="px-5 py-4 text-gray-500">{customer.cpfLast4 ? `•••.•••.•••-${customer.cpfLast4}` : "—"}</td><td className="px-5 py-4 font-black text-violet-700">{customer.loyaltyPoints}</td><td className="px-5 py-4 font-semibold">{customer.orders}</td><td className="px-5 py-4 font-black">{money(customer.totalSpent)}</td><td className="px-5 py-4"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{segmentLabel[customer.segment]}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${customer.lifecycle === "active" ? "bg-emerald-50 text-emerald-700" : customer.lifecycle === "sleeping" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{lifecycleLabel[customer.lifecycle]}</span></td><td className="px-5 py-4">{customer.phone.replace(/\D/g, "") && <a href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"><MessageCircle className="h-3.5 w-3.5"/>WhatsApp</a>}</td></tr>)}</tbody></table></div>
      {!filtered.length && <div className="px-6 py-14 text-center"><Users className="mx-auto h-9 w-9 text-gray-300"/><p className="mt-3 text-sm text-gray-500">Nenhum cliente encontrado.</p></div>}
    </section>
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={createCustomer} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Novo cliente</h2><p className="text-sm text-gray-500">Cria uma conta que poderá entrar usando CPF + PIN.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5"/></button></div><div className="mt-5 grid gap-3"><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome completo" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/><input required value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="WhatsApp / telefone" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/><input required inputMode="numeric" value={draft.cpf} onChange={(e) => setDraft({ ...draft, cpf: e.target.value })} placeholder="CPF" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/><input required inputMode="numeric" minLength={4} maxLength={6} value={draft.pin} onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "").slice(0,6) })} placeholder="PIN de 4 a 6 números" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/><input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="E-mail (opcional)" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-bold">Cancelar</button><button disabled={busy} className="h-10 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">{busy ? "Salvando..." : "Cadastrar cliente"}</button></div></form></div>}
  </>
}
