"use client"

import { MessageCircle, Search, Users } from "lucide-react"
import { useMemo, useState } from "react"
import type { CustomerSummary } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))

export function CustomersPanel({ customers }: { customers: CustomerSummary[] }) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return customers.filter((customer) => !query || customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query))
  }, [customers, search])
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-gray-900">Clientes</h2><p className="text-sm text-gray-500">Gerado automaticamente a partir dos pedidos.</p></div><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente" className="h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400" /></label></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Pedidos</th><th className="px-5 py-3">Total gasto</th><th className="px-5 py-3">Último pedido</th><th className="px-5 py-3">Contato</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((customer) => <tr key={customer.key}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 font-black text-blue-700">{customer.name.slice(0,1).toUpperCase()}</div><div><p className="font-bold text-gray-900">{customer.name}</p><p className="text-xs text-gray-500">{customer.phone}</p></div></div></td><td className="px-5 py-4 font-semibold text-gray-700">{customer.orders}</td><td className="px-5 py-4 font-black text-gray-900">{money(customer.totalSpent)}</td><td className="px-5 py-4 text-gray-600">{date(customer.lastOrderAt)}</td><td className="px-5 py-4"><a href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a></td></tr>)}</tbody></table></div>
      {filtered.length === 0 && <div className="px-6 py-14 text-center"><Users className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 text-sm text-gray-500">Nenhum cliente encontrado.</p></div>}
    </section>
  )
}
