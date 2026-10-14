"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"
import { CircleDollarSign, Image as ImageIcon, PackagePlus, Pencil, Power, Save, Trash2, Upload, X } from "lucide-react"
import type { Category, Product, ProductComposition, ProductModifierGroup } from "@/lib/types"
import { isPricedFlavorGroup, PRICED_FLAVOR_DESCRIPTION } from "@/lib/product-composition"
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

type FlavorRow = { key: string; optionId?: number; name: string; price: string }
const freshFlavor = (): FlavorRow => ({ key: `${Date.now()}-${Math.random()}`, name: "", price: "" })
const parseMoney = (value: string) => Number(value.trim().replace(/\s/g, "").replace(",", "."))
const toMoneyText = (value: number) => value.toFixed(2).replace(".", ",")

// Converte a composição atual para a estrutura da API, preservando grupos extras, receitas e ingredientes.
function copyComposition(composition: ProductComposition) {
  return {
    recipe: composition.recipe.map(row => ({ ingredientId: row.ingredientId, quantity: row.quantity })),
    modifierGroups: composition.modifierGroups.filter(group => !isPricedFlavorGroup(group)).map((group, index) => ({
      ...((group.usedByProducts || 0) > 1 ? { existingGroupId: group.id } : {}),
      name: group.name, description: group.description, required: group.required,
      minSelect: group.minSelect, maxSelect: group.maxSelect,
      selectionMode: group.selectionMode || "unique", includedQuantity: group.includedQuantity,
      active: group.active, sortOrder: index + 1,
      options: group.options.map((option, position) => ({
        name: option.name, description: option.description, priceDelta: option.priceDelta,
        includedEligible: option.includedEligible, active: option.active, sortOrder: position,
        ingredients: (option.ingredients || []).map(ingredient => ({ ingredientId: ingredient.ingredientId, quantity: ingredient.quantity })),
      })),
    })),
  }
}

const emptyDraft: ProductDraft = { name: "", description: "", category: "Salgados", price: "", image: "", featured: false, trackStock: false, stock: "0", minStock: "0" }

export function ProductsPanel({ products, categories, onProductsChanged }: { products: Product[]; categories: Category[]; onProductsChanged: (products: Product[]) => void }) {
  const [draft, setDraft] = useState<ProductDraft>(() => ({ ...emptyDraft, category: categories.filter(item => item.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }))[0]?.name || "Salgados" }))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState("")
  const [compositionProduct, setCompositionProduct] = useState<Product | null>(null)
  useEffect(() => {
    if (compositionProduct) document.getElementById("complementos-do-produto")?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [compositionProduct])
  const [flavorMode, setFlavorMode] = useState(false)
  const [flavors, setFlavors] = useState<FlavorRow[]>([freshFlavor()])
  const [flavorComposition, setFlavorComposition] = useState<ProductComposition | null>(null)
  const [flavorLoading, setFlavorLoading] = useState(false)
  const minFlavorPrice = useMemo(() => {
    const values = flavors.map(item => parseMoney(item.price)).filter(value => Number.isFinite(value) && value > 0)
    return values.length ? Math.min(...values) : 0
  }, [flavors])
  const activeCategories = useMemo(() => categories.filter((category) => category.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })), [categories])

  const [selectedCategory, setSelectedCategory] = useState("")
  const categoryNames = useMemo(() => [...new Set([...categories.map(item => item.name), ...products.map(item => item.category)])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })), [categories, products])
  const currentCategory = selectedCategory === "__all__" ? "__all__" : categoryNames.includes(selectedCategory) ? selectedCategory : categoryNames[0] || ""
  const visibleProducts = useMemo(() => products.filter(item => currentCategory === "__all__" || (item.category === currentCategory || item.category.startsWith(`${currentCategory} / `))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })), [products, currentCategory])
  const reusableGroups = useMemo(() => [...new Map(products.flatMap(item => item.modifierGroups || []).filter(group => group.active && group.options.length).map(group => [group.id, group])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })), [products])

  async function beginEdit(product: Product) {
    setEditingId(product.id)
    setDraft({ name: product.name, description: product.description, category: product.category, price: String(product.price).replace(".", ","), image: product.image || "", featured: product.featured, trackStock: product.trackStock, stock: String(product.stock), minStock: String(product.minStock) })
    setError("")
    setFlavorMode(false)
    setFlavors([freshFlavor()])
    setFlavorComposition(null)
    setFlavorLoading(true)
    try {
      const response = await fetch(`/api/products/${product.id}/composition`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os sabores.")
      const composition = data.composition as ProductComposition
      setFlavorComposition(composition)
      const group = composition.modifierGroups.find(isPricedFlavorGroup)
      if (group) {
        setFlavorMode(true)
        setFlavors(group.options.map(option => ({
          key: String(option.id), optionId: option.id, name: option.name,
          price: toMoneyText(product.price + option.priceDelta),
        })))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a montagem.")
    } finally {
      setFlavorLoading(false)
    }
  }

  function clearForm() {
    setEditingId(null)
    setDraft({ ...emptyDraft, category: activeCategories[0]?.name || "Salgados" })
    setFlavorMode(false)
    setFlavors([freshFlavor()])
    setFlavorComposition(null)
    setFlavorLoading(false)
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
      if (flavorLoading) throw new Error("Aguarde carregar a montagem atual.")
      const prepared = flavors.map(item => ({ ...item, name: item.name.trim(), amount: parseMoney(item.price) }))
      if (flavorMode) {
        if (!prepared.length || prepared.some(item => !item.name || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 100000)) {
          throw new Error("Preencha o nome e um preço válido em todos os sabores.")
        }
        if (new Set(prepared.map(item => item.name.toLocaleLowerCase("pt-BR"))).size !== prepared.length) {
          throw new Error("Não repita o nome de um sabor.")
        }
      }
      const price = flavorMode ? minFlavorPrice : parseMoney(draft.price)
      if (!Number.isFinite(price) || price <= 0) throw new Error("Informe um preço válido para o produto.")
      const jsonHeaders = { "Content-Type": "application/json" }
      const body = { name: draft.name, description: draft.description, category: draft.category,
        price, image: draft.image, featured: draft.featured, trackStock: draft.trackStock,
        stock: Number(draft.stock || 0), minStock: Number(draft.minStock || 0) }
      let productId = editingId
      let wasActive = products.find(item => item.id === editingId)?.active ?? true
      if (flavorMode && editingId) {
        if (!flavorComposition) throw new Error("Não foi possível verificar a montagem atual. Abra o produto novamente.")
        const shared = flavorComposition.modifierGroups.find(group => isPricedFlavorGroup(group) && (group.usedByProducts || 0) > 1)
        if (shared) throw new Error("Este grupo de sabores é compartilhado. Use a montagem detalhada para evitar alterar outros produtos.")
      }
      // Durante a montagem de sabores, o produto fica temporariamente oculto,
      // evitando que um cliente compre com valores incompletos.
      if (flavorMode && editingId && wasActive) {
        const pauseResponse = await fetch(`/api/products/${editingId}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ active: false }) })
        if (!pauseResponse.ok) throw new Error("Não foi possível pausar o produto antes de alterar os preços.")
      }
      const response = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PATCH" : "POST", headers: jsonHeaders,
        body: JSON.stringify({ ...body, ...(flavorMode ? { active: false } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o produto.")
      productId = Number(editingId || data.product?.id)
      if (flavorMode) {
        if (!Number.isInteger(productId) || !productId) throw new Error("Produto salvo, mas não foi possível identificar o código.")
        const other = flavorComposition ? copyComposition(flavorComposition) : { recipe: [], modifierGroups: [] }
        const oldFlavor = flavorComposition?.modifierGroups.find(isPricedFlavorGroup)
        const existingOptions = new Map(oldFlavor?.options.map(option => [option.id, option]) || [])
        const flavorGroup = {
          name: "Escolha o sabor", description: PRICED_FLAVOR_DESCRIPTION,
          required: true, minSelect: 1, maxSelect: 1, selectionMode: "unique" as const,
          includedQuantity: 0, active: true, sortOrder: 0,
          options: prepared.map((item, position) => ({
            name: item.name, description: existingOptions.get(item.optionId || 0)?.description || "",
            priceDelta: Number((item.amount - price).toFixed(2)), includedEligible: false,
            active: existingOptions.get(item.optionId || 0)?.active ?? true, sortOrder: position,
            ingredients: (existingOptions.get(item.optionId || 0)?.ingredients || []).map(ingredient => ({
              ingredientId: ingredient.ingredientId, quantity: ingredient.quantity,
            })),
          })),
        }
        const put = await fetch(`/api/products/${productId}/composition`, { method: "PUT", headers: jsonHeaders,
          body: JSON.stringify({ recipe: other.recipe, modifierGroups: [flavorGroup, ...other.modifierGroups] }) })
        const savedComposition = await put.json()
        if (!put.ok) throw new Error(`O produto ficou oculto porque os sabores não foram salvos: ${savedComposition.error || "erro na montagem"}. Abra-o e tente novamente.`)
        const resume = await fetch(`/api/products/${productId}`, { method: "PATCH", headers: jsonHeaders,
          body: JSON.stringify({ active: wasActive }) })
        if (!resume.ok) throw new Error("Sabores salvos, mas não foi possível reativar o produto. Confira o status antes de vender.")
      }
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
    <section data-ui-patch="sf-composition-fullscreen-reuse-v1" className={`grid min-w-0 gap-5 ${compositionProduct ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,.6fr)]"}`}>
      <div data-tutorial="products-list" className={`${compositionProduct ? "hidden" : ""} min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="text-lg font-bold text-gray-900">Produtos</h2><p className="text-sm text-gray-500">Itens exibidos no cardápio público.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{visibleProducts.filter((product) => product.active).length} ativos nesta seleção</span></div>
        <div className="border-b border-gray-100 px-5 py-4">
          <label className="block text-sm font-bold text-gray-800">Categoria para editar
            <select value={currentCategory} onChange={event => setSelectedCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
              {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
              <option value="__all__">Todas as categorias</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-gray-500">{visibleProducts.length} produto(s) · em ordem alfabética</p>
        </div>
        <div className="divide-y divide-gray-100">
          {!visibleProducts.length && <p className="px-5 py-6 text-sm text-gray-500">Nenhum produto nesta categoria.</p>}
          {visibleProducts.map((product) => {
            const outOfStock = product.trackStock && product.stock <= 0
            return <div key={product.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl ${product.active ? "bg-amber-50" : "bg-gray-100 grayscale"}`}>{product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : "🥟"}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900">{product.name}</h3><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{product.category}</span>{product.featured && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Destaque</span>}{!product.active && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Inativo</span>}{outOfStock && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Sem estoque</span>}{Boolean(product.modifierGroups?.length) && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Montagem</span>}{product.ingredientStockAvailable === false && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Ingrediente indisponível</span>}</div><p className="mt-0.5 text-sm text-gray-500">{product.description || "Sem descrição"}</p>{product.trackStock && <p className="mt-1 text-xs font-medium text-gray-400">Estoque: {product.stock}</p>}</div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end"><strong className="min-w-24 text-right text-base text-gray-950">{product.modifierGroups?.some(isPricedFlavorGroup) ? "A partir de " : ""}{formatCurrency(product.price)}</strong><button onClick={() => setCompositionProduct(product)} type="button" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100" data-tutorial="product-composition" aria-label={`Montagem e ficha técnica de ${product.name}`}><PackagePlus className="h-4 w-4" /> Montagem</button><button onClick={() => beginEdit(product)} type="button" className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700" data-tutorial="product-edit" aria-label={`Editar ${product.name}`}><Pencil className="h-4 w-4" /></button><button onClick={() => product.active ? remove(product) : changeActive(product, true)} disabled={busy} type="button" className={`rounded-lg p-2 ${product.active ? "text-gray-500 hover:bg-red-50 hover:text-red-700" : "text-emerald-600 hover:bg-emerald-50"}`} aria-label={product.active ? `Desativar ${product.name}` : `Ativar ${product.name}`}>{product.active ? <Trash2 className="h-4 w-4" /> : <Power className="h-4 w-4" />}</button></div>
            </div>
          })}
        </div>
      </div>

      <form data-tutorial="products-form" onSubmit={submit} className={`${compositionProduct ? "hidden" : ""} h-fit min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm`}>
        <div className="mb-5 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2">{editingId ? <Pencil className="h-5 w-5 text-blue-700" /> : <PackagePlus className="h-5 w-5 text-blue-700" />}<h2 className="font-bold text-gray-900">{editingId ? "Editar produto" : "Novo produto"}</h2></div><p className="mt-1 text-sm text-gray-500">Cadastre produto, escolha sabores e seus preços. Para combos e extras, use a montagem detalhada no mesmo painel.</p></div>{editingId && <button type="button" onClick={clearForm} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cancelar edição"><X className="h-4 w-4" /></button>}</div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

        <div className="space-y-4">
          <label data-tutorial="product-name" className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome *</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Coxinha de frango" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Descrição</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Descrição curta" rows={3} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label data-tutorial="product-category" className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Categoria *</span><select required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{activeCategories.map((category) => <option key={category.id} value={category.name}>{category.name.includes(" / ") ? `↳ ${category.name.split(" / ")[1]} (${category.name.split(" / ")[0]})` : category.name}</option>)}</select></label><label data-tutorial="product-price" className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">{flavorMode ? "Preço inicial (automático)" : "Preço *"}</span><div className="relative"><CircleDollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required={!flavorMode} readOnly={flavorMode} inputMode="decimal" value={flavorMode ? (minFlavorPrice ? toMoneyText(minFlavorPrice) : "") : draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="1,25" className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div></label></div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <label className="flex items-start gap-3 text-sm font-bold text-gray-900">
              <input type="checkbox" checked={flavorMode} disabled={flavorLoading || Boolean(flavorComposition?.modifierGroups.some(isPricedFlavorGroup))}
                onChange={event => { setFlavorMode(event.target.checked); if (event.target.checked && !flavors.length) setFlavors([freshFlavor()]) }} className="mt-1 h-5 w-5" />
              <span><span className="block">Cada sabor tem um preço diferente</span><small className="mt-1 block font-normal text-gray-600">Ex.: Pastel seco — Carne R$ 9,00, Queijo R$ 10,00, Frango R$ 12,00. O cliente escolhe um sabor por unidade.</small></span>
            </label>
            {flavorLoading && <p className="mt-3 text-xs text-gray-500">Carregando sabores existentes...</p>}
            {flavorMode && <div className="mt-4 space-y-2">
              {flavors.map((item, index) => <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_110px_32px] gap-2">
                <input aria-label={`Nome do sabor ${index + 1}`} placeholder="Sabor (ex.: Carne)" value={item.name}
                  onChange={event => setFlavors(current => current.map(row => row.key === item.key ? {...row, name: event.target.value} : row))}
                  className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm" />
                <input aria-label={`Preço final do sabor ${index + 1}`} placeholder="R$ 0,00" inputMode="decimal" value={item.price}
                  onChange={event => setFlavors(current => current.map(row => row.key === item.key ? {...row, price: event.target.value} : row))}
                  className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-2 text-sm" />
                <button type="button" aria-label={`Remover sabor ${index + 1}`} disabled={flavors.length === 1}
                  onClick={() => setFlavors(current => current.filter(row => row.key !== item.key))}
                  className="rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="mx-auto h-4 w-4" /></button>
              </div>)}
              <button type="button" onClick={() => setFlavors(current => [...current, freshFlavor()])} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700">+ Adicionar sabor</button>
              <p className="text-xs text-gray-600">Preço no cardápio: <strong>{minFlavorPrice ? `a partir de ${formatCurrency(minFlavorPrice)}` : "informe os valores"}</strong>. Não soma o preço duas vezes.</p>
            </div>}
          </div>

          <div data-tutorial="product-image" className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-3">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Foto do salgado</span>
            {draft.image && <div className="mb-3 flex items-center gap-3 rounded-xl bg-white p-2"><img src={draft.image} alt="Prévia" className="h-20 w-20 rounded-lg object-cover" /><div className="min-w-0"><p className="text-sm font-bold text-gray-800">Imagem selecionada</p><p className="truncate text-xs text-gray-400">{draft.image}</p><button type="button" onClick={() => setDraft({ ...draft, image: "" })} className="mt-1 text-xs font-bold text-red-600">Remover foto</button></div></div>}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-bold text-blue-700 ring-1 ring-gray-200 hover:bg-blue-50"><Upload className="h-4 w-4" />{uploadingImage ? "Enviando imagem..." : "Escolher do celular ou computador"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploadingImage} className="hidden" /></label>
            <p className="mt-2 text-center text-[11px] text-gray-400">JPG, PNG ou WEBP · máximo 5 MB</p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"><span><strong className="block text-sm text-gray-800">Produto em destaque</strong><small className="text-xs text-gray-500">Aparece primeiro no cardápio.</small></span><input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} className="h-5 w-5" /></label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"><span><span className="flex items-center gap-1.5"><strong className="block text-sm text-gray-800">Controlar estoque</strong><HelpTip helpKey="products.readyStock" /></span><small className="text-xs text-gray-500">Impede venda acima do saldo.</small></span><input type="checkbox" checked={draft.trackStock} onChange={(e) => setDraft({ ...draft, trackStock: e.target.checked })} className="h-5 w-5" /></label>
          {draft.trackStock && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Quantidade em estoque</span><input type="number" min="0" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Estoque mínimo / alerta</span><input type="number" min="0" value={draft.minStock} onChange={(e) => setDraft({ ...draft, minStock: e.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label></div>}
        </div>
        <button data-tutorial="product-save" disabled={busy || uploadingImage || flavorLoading || activeCategories.length === 0} type="submit" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar produto"}</button>
      </form>
      {compositionProduct && <div className="w-full min-w-0 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold text-gray-900">Montagem de {compositionProduct.name}</h3><button type="button" onClick={() => setCompositionProduct(null)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold">Fechar montagem</button></div>
        <ProductCompositionEditor embedded product={compositionProduct} catalogProducts={products} reusableGroups={reusableGroups}
          onClose={() => setCompositionProduct(null)} onSaved={refreshProducts} />
      </div>}
    </section>
  )
}
