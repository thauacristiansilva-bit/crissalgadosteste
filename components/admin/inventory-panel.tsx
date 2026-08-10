"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, PackageSearch, Search } from "lucide-react"
import type { Product } from "@/lib/types"

export function InventoryPanel({ products, onProductsChanged }: { products: Product[]; onProductsChanged: (products: Product[]) => void }) {
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) }, [products, search])
  const alerts = products.filter((p) => p.trackStock && p.stock <= p.minStock).length
  const exhausted = products.filter((p) => p.trackStock && p.stock <= 0).length

  async function patch(product: Product, changes: Partial<Product>) {
    setBusyId(product.id)
    try { const response = await fetch(`/api/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); const data = await response.json(); if (response.ok) onProductsChanged(products.map((item) => item.id === product.id ? data.product : item)) } finally { setBusyId(null) }
  }

  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Inventário</h2><p className="text-sm text-gray-500"><span className="font-bold text-emerald-600">{products.length - exhausted} disponível</span> · <span className="font-bold text-amber-600">{alerts} alerta</span> · <span className="font-bold text-red-600">{exhausted} esgotado</span></p></div><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procure um produto" className="h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm"/></label></div>
    <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Controle</th><th className="px-5 py-3">Disponibilidade</th><th className="px-5 py-3">Estoque</th><th className="px-5 py-3">Estoque mín.</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((product) => { const alert = product.trackStock && product.stock <= product.minStock; return <tr key={product.id} className={alert ? "bg-amber-50/40" : ""}><td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-bold">{product.name}</span>{alert && <AlertTriangle className="h-4 w-4 text-amber-500"/>}</div><span className="text-xs text-gray-400">{product.category}</span></td><td className="px-5 py-4"><input type="checkbox" checked={product.trackStock} onChange={(e) => patch(product, { trackStock: e.target.checked })} disabled={busyId === product.id} className="h-5 w-5"/></td><td className="px-5 py-4"><button onClick={() => patch(product, { active: !product.active })} className={`rounded-full px-3 py-1 text-xs font-black ${product.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{product.active ? "Disponível" : "Indisponível"}</button></td><td className="px-5 py-4"><input type="number" min="0" value={product.stock} disabled={!product.trackStock} onChange={(e) => patch(product, { stock: Number(e.target.value) })} className="h-9 w-24 rounded-lg border border-gray-200 px-2 disabled:bg-gray-100"/></td><td className="px-5 py-4"><input type="number" min="0" value={product.minStock} disabled={!product.trackStock} onChange={(e) => patch(product, { minStock: Number(e.target.value) })} className="h-9 w-24 rounded-lg border border-gray-200 px-2 disabled:bg-gray-100"/></td></tr> })}</tbody></table></div>
    {!filtered.length && <div className="p-14 text-center text-gray-400"><PackageSearch className="mx-auto h-9 w-9"/><p className="mt-2 text-sm">Nenhum produto encontrado.</p></div>}
  </section>
}
