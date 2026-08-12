"use client"

import { ChangeEvent, FormEvent, useMemo, useState } from "react"
import { CircleDollarSign, Image as ImageIcon, PackagePlus, Pencil, Power, Save, Trash2, Upload, X } from "lucide-react"
import type { Category, Product } from "@/lib/types"
import { ProductCompositionEditor } from "@/components/admin/product-composition-editor"
import { HelpTip } from "@/components/admin/help-tip"

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

type ProductDraft = {
  name: string
  description: string
  category: string
  price: string
  image: string
  featured: boolean
  trackStock: boolean
  stock: string
  minStock: string
}

const emptyDraft: ProductDraft = { name: "", description: "", category: "Salgados", price: "", image: "", featured: false, trackStock: false, stock: "0", minStock: "0" }

export function ProductsPanel({ products, categories, onProductsChanged }: { products: Product[]; categories: Category[]; onProductsChanged: (products: Product[]) => void }) {
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState("")
  const [compositionProduct, setCompositionProduct] = useState<Product | null>(null)
  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])

  function beginEdit(product: Product) {
    setEditingId(product.id)
    setDraft({ name: product.name, description: product.description, category: product.category, price: String(product.price).replace(".", ","), image: product.image || "", featured: product.featured, trackStock: product.trackStock, stock: String(product.stock), minStock: String(product.minStock) })
    setError("")
  }

  function clearForm() {
    setEditingId(null)
    setDraft({ ...emptyDraft, category: activeCategories[0]?.name || "Salgados" })
    setError("")
  }

  async function refreshProducts() {
    const response = await fetch("/api/dashboard", { cache: "no-store" })
    const data = await response.json()
    if (response.ok) onProductsChanged(data.products)
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/uploads/product-image", { method: "POST", body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar a imagem.")
      setDraft((current) => ({ ...current, image: data.url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.")
    } finally {
      setUploadingImage(false)
      event.target.value = ""
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const price = Number(draft.price.replace(",", "."))
      const response = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, description: draft.description, category: draft.category, price, image: draft.image, featured: draft.featured, trackStock: draft.trackStock, stock: Number(draft.stock || 0), minStock: Number(draft.minStock || 0) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o produto.")
      await refreshProducts()
      clearForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar produto.")
    } finally {
      setBusy(false)
    }
  }

  async function changeActive(product: Product, active: boolean) {
    setBusy(true)
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o produto.")
      await refreshProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar produto.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Desativar ${product.name} do cardápio?`)) return
    await changeActive(product, false)
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,.6fr)]">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="text-lg font-bold text-gray-900">Produtos</h2><p className="text-sm text-gray-500">Itens exibidos no cardápio público.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{products.filter((product) => product.active).length} ativos</span></div>
        <div className="divide-y divide-gray-100">
          {products.map((product) => {
            const outOfStock = product.trackStock && product.stock <= 0
            return <div key={product.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl ${product.active ? "bg-amber-50" : "bg-gray-100 grayscale"}`}>{product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : "🥟"}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900">{product.name}</h3><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{product.category}</span>{product.featured && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Destaque</span>}{!product.active && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Inativo</span>}{outOfStock && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Sem estoque</span>}{Boolean(product.modifierGroups?.length) && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Montagem</span>}{product.ingredientStockAvailable === false && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Ingrediente indisponível</span>}</div><p className="mt-0.5 text-sm text-gray-500">{product.description || "Sem descrição"}</p>{product.trackStock && <p className="mt-1 text-xs font-medium text-gray-400">Estoque: {product.stock}</p>}</div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end"><strong className="min-w-24 text-right text-base text-gray-950">{formatCurrency(product.price)}</strong><button onClick={() => setCompositionProduct(product)} type="button" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100" aria-label={`Montagem e ficha técnica de ${product.name}`}><PackagePlus className="h-4 w-4" /> Montagem</button><button onClick={() => beginEdit(product)} type="button" className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700" aria-label={`Editar ${product.name}`}><Pencil className="h-4 w-4" /></button><button onClick={() => product.active ? remove(product) : changeActive(product, true)} disabled={busy} type="button" className={`rounded-lg p-2 ${product.active ? "text-gray-500 hover:bg-red-50 hover:text-red-700" : "text-emerald-600 hover:bg-emerald-50"}`} aria-label={product.active ? `Desativar ${product.name}` : `Ativar ${product.name}`}>{product.active ? <Trash2 className="h-4 w-4" /> : <Power className="h-4 w-4" />}</button></div>
            </div>
          })}
        </div>
      </div>

      <form onSubmit={submit} className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-20">
        <div className="mb-5 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2">{editingId ? <Pencil className="h-5 w-5 text-blue-700" /> : <PackagePlus className="h-5 w-5 text-blue-700" />}<h2 className="font-bold text-gray-900">{editingId ? "Editar produto" : "Novo produto"}</h2></div><p className="mt-1 text-sm text-gray-500">Preço, imagem, categoria e estoque. Complementos e ficha técnica ficam no botão “Montagem”.</p></div>{editingId && <button type="button" onClick={clearForm} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cancelar edição"><X className="h-4 w-4" /></button>}</div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome *</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Coxinha de frango" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Descrição</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Descrição curta" rows={3} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Categoria *</span><select required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{activeCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Preço *</span><div className="relative"><CircleDollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="1,25" className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div></label></div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-3">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Foto do salgado</span>
            {draft.image && <div className="mb-3 flex items-center gap-3 rounded-xl bg-white p-2"><img src={draft.image} alt="Prévia" className="h-20 w-20 rounded-lg object-cover" /><div className="min-w-0"><p className="text-sm font-bold text-gray-800">Imagem selecionada</p><p className="truncate text-xs text-gray-400">{draft.image}</p><button type="button" onClick={() => setDraft({ ...draft, image: "" })} className="mt-1 text-xs font-bold text-red-600">Remover foto</button></div></div>}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-bold text-blue-700 ring-1 ring-gray-200 hover:bg-blue-50"><Upload className="h-4 w-4" />{uploadingImage ? "Enviando imagem..." : "Escolher do celular ou computador"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploadingImage} className="hidden" /></label>
            <p className="mt-2 text-center text-[11px] text-gray-400">JPG, PNG ou WEBP · máximo 5 MB</p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"><span><strong className="block text-sm text-gray-800">Produto em destaque</strong><small className="text-xs text-gray-500">Aparece primeiro no cardápio.</small></span><input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} className="h-5 w-5" /></label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"><span><span className="flex items-center gap-1.5"><strong className="block text-sm text-gray-800">Controlar estoque</strong><HelpTip helpKey="products.readyStock" /></span><small className="text-xs text-gray-500">Impede venda acima do saldo.</small></span><input type="checkbox" checked={draft.trackStock} onChange={(e) => setDraft({ ...draft, trackStock: e.target.checked })} className="h-5 w-5" /></label>
          {draft.trackStock && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Quantidade em estoque</span><input type="number" min="0" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Estoque mínimo / alerta</span><input type="number" min="0" value={draft.minStock} onChange={(e) => setDraft({ ...draft, minStock: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label></div>}
        </div>
        <button disabled={busy || uploadingImage || activeCategories.length === 0} type="submit" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar produto"}</button>
      </form>
      <ProductCompositionEditor product={compositionProduct} onClose={() => setCompositionProduct(null)} onSaved={refreshProducts} />
    </section>
  )
}
