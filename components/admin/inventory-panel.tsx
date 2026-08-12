"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { AlertTriangle, PackageSearch, Plus, Save, Search } from "lucide-react"
import type { Ingredient, IngredientUnit, InventoryMovement, Product } from "@/lib/types"

type IngredientDraft = {
  name: string
  unit: IngredientUnit
  stockQuantity: string
  minStockQuantity: string
  unitCost: string
}

const emptyIngredient: IngredientDraft = {
  name: "",
  unit: "g",
  stockQuantity: "0",
  minStockQuantity: "0",
  unitCost: "0",
}

const units: Array<{ value: IngredientUnit; label: string }> = [
  { value: "g", label: "gramas (g)" },
  { value: "kg", label: "quilos (kg)" },
  { value: "ml", label: "mililitros (ml)" },
  { value: "l", label: "litros (L)" },
  { value: "unit", label: "unidade" },
  { value: "portion", label: "porção" },
]

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

function parseDecimal(value: string) {
  return Number(value.replace(",", "."))
}

export function InventoryPanel({
  products,
  onProductsChanged,
}: {
  products: Product[]
  onProductsChanged: (products: Product[]) => void
}) {
  const [tab, setTab] = useState<"products" | "ingredients">("products")
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [ingredientDraft, setIngredientDraft] = useState<IngredientDraft>(emptyIngredient)
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({})
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loadingIngredients, setLoadingIngredients] = useState(false)

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((product) =>
      !q || product.name.toLowerCase().includes(q) || product.category.toLowerCase().includes(q),
    )
  }, [products, search])

  const filteredIngredients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ingredients.filter((ingredient) => !q || ingredient.name.toLowerCase().includes(q))
  }, [ingredients, search])

  const productAlerts = products.filter((product) => product.trackStock && product.stock <= product.minStock).length
  const productExhausted = products.filter((product) => product.trackStock && product.stock <= 0).length
  const ingredientAlerts = ingredients.filter((ingredient) => ingredient.active && ingredient.stockQuantity <= ingredient.minStockQuantity).length
  const ingredientExhausted = ingredients.filter((ingredient) => ingredient.active && ingredient.stockQuantity <= 0).length

  async function loadIngredients() {
    setLoadingIngredients(true)
    setError("")
    try {
      const [ingredientResponse, movementResponse] = await Promise.all([
        fetch("/api/admin/ingredients", { cache: "no-store" }),
        fetch("/api/admin/inventory-movements?limit=30", { cache: "no-store" }),
      ])
      const data = await ingredientResponse.json()
      const movementData = await movementResponse.json()
      if (!ingredientResponse.ok) throw new Error(data.error || "Não foi possível carregar ingredientes.")
      if (!movementResponse.ok) throw new Error(movementData.error || "Não foi possível carregar movimentações.")
      setIngredients(data.ingredients)
      setMovements(movementData.movements || [])
      setStockDrafts(Object.fromEntries((data.ingredients as Ingredient[]).map((item) => [item.id, String(item.stockQuantity).replace(".", ",")])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar ingredientes.")
    } finally {
      setLoadingIngredients(false)
    }
  }

  useEffect(() => {
    if (tab === "ingredients" && !ingredients.length) void loadIngredients()
  }, [tab])

  async function patchProduct(product: Product, changes: Partial<Product>) {
    setBusyId(product.id)
    setError("")
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o produto.")
      onProductsChanged(products.map((item) => item.id === product.id ? data.product : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar produto.")
    } finally {
      setBusyId(null)
    }
  }

  async function createIngredient(event: FormEvent) {
    event.preventDefault()
    setBusyId(-1)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ingredientDraft.name,
          unit: ingredientDraft.unit,
          stockQuantity: parseDecimal(ingredientDraft.stockQuantity),
          minStockQuantity: parseDecimal(ingredientDraft.minStockQuantity),
          unitCost: parseDecimal(ingredientDraft.unitCost),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar o ingrediente.")
      setIngredientDraft(emptyIngredient)
      setMessage(`${data.ingredient.name} cadastrado.`)
      await loadIngredients()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao cadastrar ingrediente.")
    } finally {
      setBusyId(null)
    }
  }

  async function patchIngredient(ingredient: Ingredient, changes: Record<string, unknown>) {
    setBusyId(ingredient.id)
    setError("")
    try {
      const response = await fetch(`/api/admin/ingredients/${ingredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o ingrediente.")
      setIngredients((current) => current.map((item) => item.id === ingredient.id ? data.ingredient : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar ingrediente.")
    } finally {
      setBusyId(null)
    }
  }

  async function moveIngredient(ingredient: Ingredient, kind: "manual_in" | "manual_out" | "waste", label: string) {
    const raw = window.prompt(`${label} de ${ingredient.name}: informe a quantidade.`)
    if (raw == null) return
    const quantity = parseDecimal(raw)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Informe uma quantidade maior que zero.")
      return
    }
    const note = window.prompt("Observação (opcional):") || label
    setBusyId(ingredient.id)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/admin/ingredients/${ingredient.id}/movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, quantity, note }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a movimentação.")
      setMessage(`${label} registrada para ${ingredient.name}.`)
      await loadIngredients()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao movimentar estoque.")
    } finally {
      setBusyId(null)
    }
  }

  async function adjustIngredientStock(ingredient: Ingredient) {
    const quantity = parseDecimal(stockDrafts[ingredient.id] ?? String(ingredient.stockQuantity))
    setBusyId(ingredient.id)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/admin/ingredients/${ingredient.id}/movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "adjustment", quantity, note: "Ajuste manual no inventário" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível ajustar o estoque.")
      setIngredients((current) => current.map((item) => item.id === ingredient.id ? data.ingredient : item))
      setStockDrafts((current) => ({ ...current, [ingredient.id]: String(data.ingredient.stockQuantity).replace(".", ",") }))
      setMessage(`Estoque de ${ingredient.name} ajustado.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao ajustar estoque.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-black">Inventário</h2><p className="text-sm text-gray-500">Controle de produtos prontos e ingredientes da ficha técnica.</p></div>
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "products" ? "Procure um produto" : "Procure um ingrediente"} className="h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm"/></label>
        </div>
        <div className="mt-4 flex gap-2"><button type="button" onClick={() => setTab("products")} className={`rounded-xl px-4 py-2 text-sm font-black ${tab === "products" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600"}`}>Produtos</button><button type="button" onClick={() => setTab("ingredients")} className={`rounded-xl px-4 py-2 text-sm font-black ${tab === "ingredients" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600"}`}>Ingredientes</button></div>
      </div>

      {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
      {message && <div className="m-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{message}</div>}

      {tab === "products" ? <>
        <div className="border-b border-gray-100 px-5 py-3 text-sm text-gray-500"><span className="font-bold text-emerald-600">{products.length - productExhausted} disponível</span> · <span className="font-bold text-amber-600">{productAlerts} alerta</span> · <span className="font-bold text-red-600">{productExhausted} esgotado</span></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Controle</th><th className="px-5 py-3">Disponibilidade</th><th className="px-5 py-3">Estoque</th><th className="px-5 py-3">Estoque mín.</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredProducts.map((product) => { const alert = product.trackStock && product.stock <= product.minStock; return <tr key={product.id} className={alert ? "bg-amber-50/40" : ""}><td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-bold">{product.name}</span>{alert && <AlertTriangle className="h-4 w-4 text-amber-500"/>}</div><span className="text-xs text-gray-400">{product.category}</span></td><td className="px-5 py-4"><input type="checkbox" checked={product.trackStock} onChange={(event) => patchProduct(product, { trackStock: event.target.checked })} disabled={busyId === product.id} className="h-5 w-5"/></td><td className="px-5 py-4"><button type="button" onClick={() => patchProduct(product, { active: !product.active })} className={`rounded-full px-3 py-1 text-xs font-black ${product.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{product.active ? "Disponível" : "Indisponível"}</button></td><td className="px-5 py-4"><input type="number" min="0" defaultValue={product.stock} disabled={!product.trackStock || busyId === product.id} onBlur={(event) => { const value = Number(event.target.value); if (value !== product.stock) void patchProduct(product, { stock: value }) }} className="h-9 w-24 rounded-lg border border-gray-200 px-2 disabled:bg-gray-100"/></td><td className="px-5 py-4"><input type="number" min="0" defaultValue={product.minStock} disabled={!product.trackStock || busyId === product.id} onBlur={(event) => { const value = Number(event.target.value); if (value !== product.minStock) void patchProduct(product, { minStock: value }) }} className="h-9 w-24 rounded-lg border border-gray-200 px-2 disabled:bg-gray-100"/></td></tr> })}</tbody></table></div>
        {!filteredProducts.length && <div className="p-14 text-center text-gray-400"><PackageSearch className="mx-auto h-9 w-9"/><p className="mt-2 text-sm">Nenhum produto encontrado.</p></div>}
      </> : <>
        <div className="border-b border-gray-100 px-5 py-3 text-sm text-gray-500"><span className="font-bold text-emerald-600">{ingredients.filter((item) => item.active).length - ingredientExhausted} com saldo</span> · <span className="font-bold text-amber-600">{ingredientAlerts} alerta</span> · <span className="font-bold text-red-600">{ingredientExhausted} esgotado</span></div>
        <form onSubmit={createIngredient} className="grid gap-2 border-b border-gray-100 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_.8fr_.8fr_.8fr_auto]"><input required value={ingredientDraft.name} onChange={(event) => setIngredientDraft({ ...ingredientDraft, name: event.target.value })} placeholder="Novo ingrediente" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/><select value={ingredientDraft.unit} onChange={(event) => setIngredientDraft({ ...ingredientDraft, unit: event.target.value as IngredientUnit })} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select><input value={ingredientDraft.stockQuantity} onChange={(event) => setIngredientDraft({ ...ingredientDraft, stockQuantity: event.target.value })} inputMode="decimal" placeholder="Estoque" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/><input value={ingredientDraft.minStockQuantity} onChange={(event) => setIngredientDraft({ ...ingredientDraft, minStockQuantity: event.target.value })} inputMode="decimal" placeholder="Mínimo" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/><input value={ingredientDraft.unitCost} onChange={(event) => setIngredientDraft({ ...ingredientDraft, unitCost: event.target.value })} inputMode="decimal" placeholder="Custo/un." className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/><button disabled={busyId === -1} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50"><Plus className="h-4 w-4"/>Cadastrar</button></form>
        {loadingIngredients ? <div className="p-12 text-center text-sm text-gray-500">Carregando ingredientes...</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-white text-left text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Ingrediente</th><th className="px-5 py-3">Unidade</th><th className="px-5 py-3">Saldo</th><th className="px-5 py-3">Mínimo</th><th className="px-5 py-3">Custo/un.</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredIngredients.map((ingredient) => { const alert = ingredient.active && ingredient.stockQuantity <= ingredient.minStockQuantity; return <tr key={ingredient.id} className={alert ? "bg-amber-50/40" : ""}><td className="px-5 py-4"><div className="flex items-center gap-2"><strong>{ingredient.name}</strong>{alert && <AlertTriangle className="h-4 w-4 text-amber-500"/>}</div><p className="text-xs text-gray-400">Valor estimado em estoque: {money(ingredient.stockQuantity * ingredient.unitCost)}</p><div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => void moveIngredient(ingredient, "manual_in", "Entrada manual")} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">+ Entrada</button><button type="button" onClick={() => void moveIngredient(ingredient, "manual_out", "Saída manual")} className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">- Saída</button><button type="button" onClick={() => void moveIngredient(ingredient, "waste", "Perda") } className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">Perda</button></div></td><td className="px-5 py-4"><select value={ingredient.unit} disabled={busyId === ingredient.id} onChange={(event) => void patchIngredient(ingredient, { unit: event.target.value })} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs">{units.map((unit) => <option key={unit.value} value={unit.value}>{unit.value}</option>)}</select></td><td className="px-5 py-4"><div className="flex items-center gap-2"><input value={stockDrafts[ingredient.id] ?? String(ingredient.stockQuantity)} onChange={(event) => setStockDrafts((current) => ({ ...current, [ingredient.id]: event.target.value }))} inputMode="decimal" className="h-9 w-24 rounded-lg border border-gray-200 px-2"/><button type="button" onClick={() => void adjustIngredientStock(ingredient)} disabled={busyId === ingredient.id} className="rounded-lg bg-blue-50 p-2 text-blue-700" title="Salvar novo saldo"><Save className="h-4 w-4"/></button></div></td><td className="px-5 py-4"><input type="number" min="0" step="0.001" defaultValue={ingredient.minStockQuantity} onBlur={(event) => { const value = Number(event.target.value); if (value !== ingredient.minStockQuantity) void patchIngredient(ingredient, { minStockQuantity: value }) }} className="h-9 w-24 rounded-lg border border-gray-200 px-2"/></td><td className="px-5 py-4"><input type="number" min="0" step="0.0001" defaultValue={ingredient.unitCost} onBlur={(event) => { const value = Number(event.target.value); if (value !== ingredient.unitCost) void patchIngredient(ingredient, { unitCost: value }) }} className="h-9 w-28 rounded-lg border border-gray-200 px-2"/></td><td className="px-5 py-4"><button type="button" onClick={() => void patchIngredient(ingredient, { active: !ingredient.active })} className={`rounded-full px-3 py-1 text-xs font-black ${ingredient.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{ingredient.active ? "Ativo" : "Inativo"}</button></td></tr> })}</tbody></table></div>}
        {!loadingIngredients && !filteredIngredients.length && <div className="p-14 text-center text-gray-400"><PackageSearch className="mx-auto h-9 w-9"/><p className="mt-2 text-sm">Nenhum ingrediente encontrado.</p></div>}
        {movements.length > 0 && <div className="border-t border-gray-100 p-5"><h3 className="font-black text-gray-900">Movimentações recentes</h3><p className="text-xs text-gray-500">Baixas automáticas, estornos e ajustes manuais ficam auditáveis por empresa.</p><div className="mt-3 space-y-2">{movements.slice(0, 12).map((movement) => <div key={movement.id} className="flex flex-col gap-1 rounded-xl bg-gray-50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-gray-800">{movement.ingredientName}</strong><span className="ml-2 text-gray-500">{movement.kind === "sale" ? "Baixa por pedido" : movement.kind === "reversal" ? "Estorno" : movement.kind === "waste" ? "Perda" : movement.kind === "manual_in" ? "Entrada manual" : movement.kind === "manual_out" ? "Saída manual" : "Ajuste"}{movement.orderId ? ` · pedido #${movement.orderId}` : ""}</span>{movement.note && <p className="text-[11px] text-gray-400">{movement.note}</p>}</div><div className="flex items-center gap-3"><strong className={movement.quantityDelta >= 0 ? "text-emerald-700" : "text-red-600"}>{movement.quantityDelta >= 0 ? "+" : ""}{movement.quantityDelta}</strong><span className="text-gray-400">{new Date(movement.createdAt).toLocaleString("pt-BR")}</span></div></div>)}</div></div>}
      </>}
    </section>
  )
}
