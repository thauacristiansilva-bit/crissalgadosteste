"use client"

import { FormEvent, useState } from "react"
import { FolderPlus, Pencil, Power, Save, X } from "lucide-react"
import type { Category } from "@/lib/types"

export function CategoriesPanel({ categories, onCategoriesChanged }: { categories: Category[]; onCategoriesChanged: (categories: Category[]) => void }) {
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function refresh() {
    const response = await fetch("/api/dashboard", { cache: "no-store" })
    const data = await response.json()
    if (response.ok) onCategoriesChanged(data.categories)
  }

  function edit(category: Category) {
    setEditingId(category.id)
    setName(category.name)
    setError("")
  }

  function clear() {
    setEditingId(null)
    setName("")
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = await fetch(editingId ? `/api/categories/${editingId}` : "/api/categories", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a categoria.")
      await refresh()
      clear()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar categoria.")
    } finally {
      setBusy(false)
    }
  }

  async function toggle(category: Category) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !category.active }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar a categoria.")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar categoria.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Categorias</h2>
          <p className="text-sm text-gray-500">Organize a navegação do cardápio.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-3 px-5 py-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.active ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>#</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900">{category.name}</p>
                <p className="text-xs text-gray-500">Ordem {category.sortOrder} · {category.active ? "Visível" : "Oculta"}</p>
              </div>
              <button onClick={() => edit(category)} className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
              <button disabled={busy} onClick={() => toggle(category)} className={`rounded-lg p-2 ${category.active ? "text-gray-500 hover:bg-red-50 hover:text-red-700" : "text-emerald-600 hover:bg-emerald-50"}`}><Power className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-2"><FolderPlus className="h-5 w-5 text-blue-700" /><h2 className="font-bold text-gray-900">{editingId ? "Editar categoria" : "Nova categoria"}</h2></div>
          {editingId && <button type="button" onClick={clear} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>}
        </div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome *</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Salgados" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <button disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "Salvando..." : "Salvar categoria"}</button>
      </form>
    </section>
  )
}
