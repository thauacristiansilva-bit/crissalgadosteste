"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Save, Trash2, X } from "lucide-react"
import type { Ingredient, Product, ProductComposition } from "@/lib/types"

type RecipeDraft = { ingredientId: string; quantity: string }
type OptionIngredientDraft = { ingredientId: string; quantity: string }
type OptionDraft = {
  key: string
  name: string
  description: string
  priceDelta: string
  includedEligible: boolean
  active: boolean
  ingredients: OptionIngredientDraft[]
}
type GroupDraft = {
  key: string
  name: string
  description: string
  required: boolean
  minSelect: string
  maxSelect: string
  includedQuantity: string
  active: boolean
  options: OptionDraft[]
}

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const unitLabel: Record<Ingredient["unit"], string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  unit: "un",
  portion: "porção",
}

function key() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function numberText(value: number) {
  return String(value).replace(".", ",")
}

function fromComposition(composition: ProductComposition) {
  return {
    recipe: composition.recipe.map((item) => ({
      ingredientId: String(item.ingredientId),
      quantity: numberText(item.quantity),
    })),
    groups: composition.modifierGroups.map((group) => ({
      key: key(),
      name: group.name,
      description: group.description,
      required: group.required,
      minSelect: String(group.minSelect),
      maxSelect: String(group.maxSelect),
      includedQuantity: String(group.includedQuantity),
      active: group.active,
      options: group.options.map((option) => ({
        key: key(),
        name: option.name,
        description: option.description,
        priceDelta: numberText(option.priceDelta),
        includedEligible: option.includedEligible,
        active: option.active,
        ingredients: (option.ingredients || []).map((ingredient) => ({
          ingredientId: String(ingredient.ingredientId),
          quantity: numberText(ingredient.quantity),
        })),
      })),
    })),
  }
}

export function ProductCompositionEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null
  onClose: () => void
  onSaved?: () => void | Promise<void>
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipe, setRecipe] = useState<RecipeDraft[]>([])
  const [groups, setGroups] = useState<GroupDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!product) return
    let cancelled = false
    setLoading(true)
    setError("")
    setMessage("")
    Promise.all([
      fetch("/api/admin/ingredients", { cache: "no-store" }).then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar ingredientes.")
        return data.ingredients as Ingredient[]
      }),
      fetch(`/api/products/${product.id}/composition`, { cache: "no-store" }).then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar a composição.")
        return data.composition as ProductComposition
      }),
    ])
      .then(([loadedIngredients, composition]) => {
        if (cancelled) return
        const drafts = fromComposition(composition)
        setIngredients(loadedIngredients)
        setRecipe(drafts.recipe)
        setGroups(drafts.groups)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Erro ao carregar composição.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [product])

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  )

  const baseCost = useMemo(
    () => recipe.reduce((sum, row) => {
      const ingredient = ingredientMap.get(Number(row.ingredientId))
      const quantity = Number(row.quantity.replace(",", "."))
      return sum + (ingredient && Number.isFinite(quantity) ? ingredient.unitCost * quantity : 0)
    }, 0),
    [recipe, ingredientMap],
  )

  if (!product) return null

  function addRecipeRow() {
    setRecipe((current) => [...current, { ingredientId: "", quantity: "" }])
  }

  function addGroup() {
    setGroups((current) => [
      ...current,
      {
        key: key(),
        name: "",
        description: "",
        required: false,
        minSelect: "0",
        maxSelect: "1",
        includedQuantity: "0",
        active: true,
        options: [],
      },
    ])
  }

  function addOption(groupKey: string) {
    setGroups((current) =>
      current.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              options: [
                ...group.options,
                {
                  key: key(),
                  name: "",
                  description: "",
                  priceDelta: "0",
                  includedEligible: true,
                  active: true,
                  ingredients: [],
                },
              ],
            }
          : group,
      ),
    )
  }

  function addOptionIngredient(groupKey: string, optionKey: string) {
    setGroups((current) =>
      current.map((group) =>
        group.key !== groupKey
          ? group
          : {
              ...group,
              options: group.options.map((option) =>
                option.key === optionKey
                  ? {
                      ...option,
                      ingredients: [...option.ingredients, { ingredientId: "", quantity: "" }],
                    }
                  : option,
              ),
            },
      ),
    )
  }

  async function save() {
    if (!product) return
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const payload = {
        recipe: recipe
          .filter((row) => row.ingredientId || row.quantity)
          .map((row) => ({
            ingredientId: Number(row.ingredientId),
            quantity: Number(row.quantity.replace(",", ".")),
          })),
        modifierGroups: groups.map((group, groupIndex) => ({
          name: group.name,
          description: group.description,
          required: group.required,
          minSelect: Number(group.minSelect || 0),
          maxSelect: Number(group.maxSelect || 1),
          includedQuantity: Number(group.includedQuantity || 0),
          active: group.active,
          sortOrder: groupIndex,
          options: group.options.map((option, optionIndex) => ({
            name: option.name,
            description: option.description,
            priceDelta: Number(option.priceDelta.replace(",", ".") || 0),
            includedEligible: option.includedEligible,
            active: option.active,
            sortOrder: optionIndex,
            ingredients: option.ingredients
              .filter((row) => row.ingredientId || row.quantity)
              .map((row) => ({
                ingredientId: Number(row.ingredientId),
                quantity: Number(row.quantity.replace(",", ".")),
              })),
          })),
        })),
      }
      const response = await fetch(`/api/products/${product.id}/composition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a composição.")
      const drafts = fromComposition(data.composition as ProductComposition)
      setRecipe(drafts.recipe)
      setGroups(drafts.groups)
      setMessage("Complementos e ficha técnica salvos.")
      await onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar composição.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0" />
      <div className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-gray-50 shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Montagem e ficha técnica</p>
            <h2 className="text-xl font-black text-gray-950">{product.name}</h2>
            <p className="mt-1 text-sm text-gray-500">Cadastre ingredientes consumidos e as escolhas que o cliente pode fazer.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 p-2 text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
          {loading ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500">Carregando composição...</div> : <>
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="font-black text-gray-900">Ficha técnica base</h3><p className="text-sm text-gray-500">Ingredientes consumidos em cada unidade vendida deste produto.</p></div>
                <div className="text-right"><p className="text-xs font-bold uppercase text-gray-400">Custo estimado base</p><strong className="text-lg text-gray-900">{money(baseCost)}</strong>{product.price > 0 && <p className="text-xs text-gray-400">Margem bruta estimada: {Math.max(0, ((product.price - baseCost) / product.price) * 100).toFixed(1)}%</p>}</div>
              </div>
              <div className="mt-4 space-y-2">
                {recipe.map((row, index) => <div key={`${index}-${row.ingredientId}`} className="grid gap-2 sm:grid-cols-[1fr_170px_40px]">
                  <select value={row.ingredientId} onChange={(event) => setRecipe((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ingredientId: event.target.value } : item))} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="">Selecione o ingrediente</option>{ingredients.filter((item) => item.active).map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} · estoque {ingredient.stockQuantity} {unitLabel[ingredient.unit]}</option>)}</select>
                  <div className="flex items-center gap-2"><input value={row.quantity} onChange={(event) => setRecipe((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} inputMode="decimal" placeholder="Quantidade" className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm"/><span className="w-12 text-xs font-bold text-gray-400">{ingredientMap.get(Number(row.ingredientId)) ? unitLabel[ingredientMap.get(Number(row.ingredientId))!.unit] : ""}</span></div>
                  <button type="button" onClick={() => setRecipe((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>)}
                {!recipe.length && <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-400">Sem ficha técnica. Nesse caso, o estoque de ingredientes não é baixado para o produto base.</p>}
              </div>
              <button type="button" onClick={addRecipeRow} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-black text-gray-700"><Plus className="h-4 w-4" /> Ingrediente</button>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-gray-900">Grupos de complementos</h3><p className="text-sm text-gray-500">Ex.: tamanho, frutas, adicionais, molhos, borda ou ponto da carne.</p></div><button type="button" onClick={addGroup} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-black text-white"><Plus className="h-4 w-4" /> Grupo</button></div>
              <div className="mt-4 space-y-4">
                {groups.map((group, groupIndex) => <article key={group.key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_110px_110px_120px_auto]">
                    <input value={group.name} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, name: event.target.value } : item))} placeholder="Nome do grupo" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold"/>
                    <input value={group.description} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, description: event.target.value } : item))} placeholder="Descrição (opcional)" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"/>
                    <label className="text-[11px] font-bold text-gray-500">Mínimo<input type="number" min="0" value={group.minSelect} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, minSelect: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"/></label>
                    <label className="text-[11px] font-bold text-gray-500">Máximo<input type="number" min="1" value={group.maxSelect} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, maxSelect: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"/></label>
                    <label className="text-[11px] font-bold text-gray-500">Incluídos grátis<input type="number" min="0" value={group.includedQuantity} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, includedQuantity: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"/></label>
                    <button type="button" onClick={() => setGroups((current) => current.filter((item) => item.key !== group.key))} className="self-end rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-gray-600"><label className="flex items-center gap-2"><input type="checkbox" checked={group.required} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, required: event.target.checked } : item))}/> Obrigatório</label><label className="flex items-center gap-2"><input type="checkbox" checked={group.active} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, active: event.target.checked } : item))}/> Ativo</label></div>

                  <div className="mt-4 space-y-3">
                    {group.options.map((option, optionIndex) => <div key={option.key} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto]">
                        <input value={option.name} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, name: event.target.value } : candidate) }))} placeholder="Opção: Nutella" className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-bold"/>
                        <input value={option.description} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, description: event.target.value } : candidate) }))} placeholder="Descrição" className="h-9 rounded-lg border border-gray-200 px-3 text-sm"/>
                        <label className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span><input value={option.priceDelta} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, priceDelta: event.target.value } : candidate) }))} inputMode="decimal" className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-2 text-sm"/></label>
                        <button type="button" onClick={() => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.filter((candidate) => candidate.key !== option.key) }))} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-gray-600"><label className="flex items-center gap-2"><input type="checkbox" checked={option.includedEligible} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, includedEligible: event.target.checked } : candidate) }))}/> Pode usar vaga grátis</label><label className="flex items-center gap-2"><input type="checkbox" checked={option.active} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, active: event.target.checked } : candidate) }))}/> Ativa</label></div>
                      <div className="mt-3 rounded-xl bg-gray-50 p-3"><div className="flex items-center justify-between"><p className="text-xs font-black text-gray-600">Ingredientes consumidos por esta opção</p><button type="button" onClick={() => addOptionIngredient(group.key, option.key)} className="text-xs font-black text-blue-700">+ Ingrediente</button></div><div className="mt-2 space-y-2">{option.ingredients.map((row, rowIndex) => <div key={`${rowIndex}-${row.ingredientId}`} className="grid gap-2 sm:grid-cols-[1fr_150px_36px]"><select value={row.ingredientId} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key !== option.key ? candidate : { ...candidate, ingredients: candidate.ingredients.map((ingredientRow, ingredientIndex) => ingredientIndex === rowIndex ? { ...ingredientRow, ingredientId: event.target.value } : ingredientRow) }) }))} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs"><option value="">Ingrediente</option>{ingredients.filter((item) => item.active).map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select><input value={row.quantity} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key !== option.key ? candidate : { ...candidate, ingredients: candidate.ingredients.map((ingredientRow, ingredientIndex) => ingredientIndex === rowIndex ? { ...ingredientRow, quantity: event.target.value } : ingredientRow) }) }))} inputMode="decimal" placeholder="Qtd." className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs"/><button type="button" onClick={() => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key !== option.key ? candidate : { ...candidate, ingredients: candidate.ingredients.filter((_, ingredientIndex) => ingredientIndex !== rowIndex) }) }))} className="rounded-lg text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button></div>)}</div></div>
                    </div>)}
                    <button type="button" onClick={() => addOption(group.key)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-700"><Plus className="h-4 w-4" /> Opção</button>
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">Grupo {groupIndex + 1} · a ordem visual segue a ordem desta lista.</p>
                </article>)}
                {!groups.length && <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">Este produto ainda não exige montagem. Adicione um grupo quando quiser oferecer tamanhos, acompanhamentos ou adicionais.</div>}
              </div>
            </section>
          </>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-700">Fechar</button><button type="button" onClick={save} disabled={loading || saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar composição"}</button></div>
      </div>
    </div>
  )
}
