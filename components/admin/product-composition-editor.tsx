"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Plus, Save, Trash2, X } from "lucide-react"
import type { Ingredient, Product, ProductComposition, ProductModifierGroup } from "@/lib/types"
import { HelpLabel, HelpTip } from "@/components/admin/help-tip"

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
  sourceGroupId?: number
  existingGroupId?: number
  name: string
  description: string
  required: boolean
  minSelect: string
  maxSelect: string
  selectionMode: "unique" | "bundle"
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
      sourceGroupId: group.id,
      existingGroupId: (group.usedByProducts || 0) > 1 ? group.id : undefined,
      name: group.name,
      description: group.description,
      required: group.required,
      minSelect: String(group.minSelect),
      maxSelect: String(group.maxSelect),
      selectionMode: group.selectionMode || "unique",
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
  embedded = false,
  reusableGroups = [],
  catalogProducts = [],
}: {
  product: Product | null
  onClose: () => void
  onSaved?: () => void | Promise<void>
  embedded?: boolean
  reusableGroups?: ProductModifierGroup[]
  catalogProducts?: Product[]
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [ingredientsAvailable, setIngredientsAvailable] = useState(true)
  const [recipe, setRecipe] = useState<RecipeDraft[]>([])
  const [groups, setGroups] = useState<GroupDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [selectedExistingGroup, setSelectedExistingGroup] = useState("")
  const [sourceCategory, setSourceCategory] = useState("")
  const [sourcePricing, setSourcePricing] = useState<"included" | "priced">("included")

  useEffect(() => {
    if (!product) return
    let cancelled = false
    setLoading(true)
    setIngredientsAvailable(true)
    setError("")
    setMessage("")
    Promise.all([
      fetch("/api/admin/ingredients", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return { available: false, ingredients: [] as Ingredient[] }
          const data = await response.json()
          return { available: true, ingredients: data.ingredients as Ingredient[] }
        })
        .catch(() => ({ available: false, ingredients: [] as Ingredient[] })),
      fetch(`/api/products/${product.id}/composition`, { cache: "no-store" }).then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar a composição.")
        return data.composition as ProductComposition
      }),
    ])
      .then(([inventory, composition]) => {
        if (cancelled) return
        const drafts = fromComposition(composition)
        setIngredients(inventory.ingredients)
        setIngredientsAvailable(inventory.available)
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
        selectionMode: "unique",
        includedQuantity: "0",
        active: true,
        options: [],
      },
    ])
  }

  function addExistingGroup() {
    const source = reusableGroups.find((item) => item.id === Number(selectedExistingGroup))
    if (!source || groups.some((item) => item.sourceGroupId === source.id)) return
    const draft = fromComposition({
      productId: product!.id,
      modifierGroups: [source],
      recipe: [],
      estimatedFoodCost: 0,
      ingredientStockAvailable: true,
    }).groups[0]
    setGroups((current) => [...current, { ...draft, existingGroupId: source.id }])
    setSelectedExistingGroup("")
  }

  function addGroupFromCategory() {
    const available = catalogProducts.filter((item) => item.active && item.id !== product!.id && item.category === sourceCategory).slice(0, 100)
    if (!available.length) return
    const priced = sourcePricing === "priced"
    setGroups((current) => [...current, {
      key: key(), name: priced ? `Escolha a bebida (${sourceCategory})` : `Sabores de ${sourceCategory}`, description: priced ? "Escolha uma opção para acompanhar o combo." : "Escolha os sabores do combo.",
      required: true, minSelect: priced ? "1" : "4", maxSelect: priced ? "1" : "4", includedQuantity: priced ? "0" : "4",
      selectionMode: priced ? "unique" : "bundle", active: true,
      options: available.map((item) => ({ key: key(), name: item.name, description: "", priceDelta: priced ? numberText(item.price) : "0", includedEligible: !priced, active: true, ingredients: [] })),
    }])
    setSourceCategory("")
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
          ...(group.existingGroupId ? { existingGroupId: group.existingGroupId } : {}),
          name: group.name,
          description: group.description,
          required: group.required,
          minSelect: Number(group.minSelect || 0),
          maxSelect: Number(group.maxSelect || 1),
          selectionMode: group.selectionMode,
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
      setMessage("Salvo! Os sabores e extras já aparecem no produto da loja.")
      await onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar composição.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={embedded ? "w-full scroll-mt-20" : "fixed inset-0 z-[96] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4"} id={embedded ? "complementos-do-produto" : undefined}>
      {!embedded && <button aria-label="Fechar" onClick={onClose} className="absolute inset-0" />}
      <div className={embedded ? "w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm" : "relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-gray-50 shadow-2xl sm:rounded-3xl"}>
        <div className={`${embedded ? "" : "sticky top-0 z-10"} flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-6`}>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Sabores e extras</p>
            <h2 className="text-xl font-black text-gray-950">{product.name}</h2>
            <p className="mt-1 text-sm text-gray-500">Escolha o que o cliente vai selecionar antes de colocar no carrinho.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 p-2 text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
          {loading ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500">Carregando composição...</div> : <>
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-gray-900">O que o cliente pode escolher?</h3><p className="text-sm text-gray-500">Ex.: Sabores → frango, carne e pizza.</p></div><button type="button" onClick={addGroup} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-black text-white"><Plus className="h-4 w-4" /> Nova escolha</button></div>
              {(reusableGroups.length > 0 || catalogProducts.some((item) => item.active && item.id !== product.id)) && <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3"><summary className="cursor-pointer text-sm font-bold text-blue-800">Já tenho sabores cadastrados <ChevronDown className="ml-1 inline h-4 w-4" /></summary>
              <p className="mt-2 text-xs text-blue-800">Aproveite uma lista pronta ou copie os nomes dos produtos de uma categoria.</p>
              {reusableGroups.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Lista de sabores já cadastrada" value={selectedExistingGroup} onChange={(event) => setSelectedExistingGroup(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-2 text-sm"><option value="">Escolher lista pronta...</option>{reusableGroups.filter((item) => !groups.some((group) => group.sourceGroupId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.options.length} opções)</option>)}</select><button type="button" disabled={!selectedExistingGroup} onClick={addExistingGroup} className="rounded-lg bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-40">Usar esta lista</button></div>}
              {catalogProducts.some((item) => item.active && item.id !== product.id) && <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Categoria de produtos para copiar sabores" value={sourceCategory} onChange={(event) => setSourceCategory(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="">Copiar sabores de uma categoria...</option>{[...new Set(catalogProducts.filter((item) => item.active && item.id !== product.id).map((item) => item.category))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })).map((name) => <option key={name} value={name}>{name}</option>)}</select><select aria-label="Cobrança das opções copiadas" value={sourcePricing} onChange={(event) => setSourcePricing(event.target.value as "priced" | "included")} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="included">Sem preço extra · sabores do combo</option><option value="priced">Com preço · bebida ou extra</option></select><button type="button" disabled={!sourceCategory} onClick={addGroupFromCategory} className="rounded-lg border border-gray-300 bg-white px-3 text-sm font-bold text-gray-800 disabled:opacity-40">Copiar</button></div>}
              <p className="mt-2 text-xs text-blue-800">Você pode copiar duas categorias no mesmo combo: salgados sem preço extra e bebidas com preço. Depois, ajuste as escolhas antes de salvar. Os nomes e preços são copiados; o estoque dos produtos de origem não é vinculado automaticamente.</p>
              </details>}
              <div className="mt-4 space-y-4">



                {groups.map((group, groupIndex) => group.existingGroupId ? <article key={group.key} className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-black text-blue-950">{group.name}</p><p className="text-xs text-blue-700">{group.options.length} sabores disponíveis neste produto.</p><details className="mt-2 text-xs text-blue-700"><summary className="cursor-pointer font-bold">Editar só neste produto</summary><button type="button" onClick={() => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, existingGroupId: undefined, sourceGroupId: undefined } : item))} className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold">Criar cópia para editar</button></details></div><button type="button" onClick={() => setGroups((current) => current.filter((item) => item.key !== group.key))} aria-label={`Remover ${group.name} deste produto`} className="rounded-lg p-2 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div><details className="mt-2 text-sm"><summary className="cursor-pointer font-bold text-blue-800">Ver sabores</summary><p className="mt-2 text-gray-700">{group.options.map((option) => option.name).join(" · ")}</p></details></article> : <details key={group.key} open className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <summary className="mb-4 cursor-pointer text-sm font-black text-gray-900">{group.name || "Novo grupo"} <span className="font-normal text-gray-500">· {group.options.length} opções</span></summary>
                  <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-bold text-gray-600">Pergunta para o cliente<input value={group.name} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, name: event.target.value } : item))} placeholder="Ex.: Escolha seus sabores" className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold"/></label><button type="button" onClick={() => setGroups((current) => current.filter((item) => item.key !== group.key))} aria-label="Excluir esta escolha" className="rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-gray-600">Como escolher<select value={group.selectionMode} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, selectionMode: event.target.value as GroupDraft["selectionMode"], includedQuantity: String(Math.min(Number(item.includedQuantity || 0), Math.max(1, Number(item.maxSelect) || 1))) } : item))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="unique">Extras ou opções</option><option value="bundle">Sabores do combo</option></select></label><label className="text-xs font-bold text-gray-600">Mínimo de escolhas<input type="number" min="0" value={group.minSelect} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, minSelect: event.target.value } : item))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"/></label><label className="text-xs font-bold text-gray-600">Máximo por produto<input type="number" min="1" value={group.maxSelect} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, maxSelect: event.target.value, includedQuantity: String(Math.min(Number(item.includedQuantity || 0), Math.max(1, Number(event.target.value) || 1))) } : item))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"/></label></div>
                  <label className="mt-3 flex items-center gap-2 text-sm font-bold text-gray-700"><input type="checkbox" checked={group.required} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, required: event.target.checked, minSelect: event.target.checked && Number(item.minSelect) < 1 ? "1" : item.minSelect } : item))}/> Cliente precisa escolher antes de comprar</label>
                  {group.selectionMode === "bundle" && <p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800">Se pedir 2 combos, pode escolher até {Number(group.maxSelect || 0) * 2} salgados. Pode repetir o mesmo sabor. O mínimo é {group.minSelect || 0} por pedido.</p>}

                  <div className="mt-4 space-y-3">
                    {group.options.map((option, optionIndex) => <div key={option.key} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                        <input aria-label={`Nome do sabor ${optionIndex + 1}`} value={option.name} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, name: event.target.value } : candidate) }))} placeholder="Ex.: Frango" className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-bold"/>
                        <label className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">+ R$</span><input aria-label={`Preço adicional de ${option.name || `opção ${optionIndex + 1}`}`} value={option.priceDelta} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, priceDelta: event.target.value } : candidate) }))} inputMode="decimal" className="h-9 w-full rounded-lg border border-gray-200 pl-10 pr-2 text-sm"/></label>
                        <button type="button" onClick={() => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.filter((candidate) => candidate.key !== option.key) }))} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <details className="mt-2 text-xs text-gray-600"><summary className="cursor-pointer font-bold">Detalhes do sabor</summary><div className="mt-2"><input aria-label="Descrição do sabor" value={option.description} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, description: event.target.value } : candidate) }))} placeholder="Descrição (opcional)" className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm"/></div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-gray-600"><label className="flex items-center gap-2"><input type="checkbox" checked={option.includedEligible} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, includedEligible: event.target.checked } : candidate) }))}/> Pode usar vaga grátis <HelpTip helpKey="composition.freeEligible" /></label><label className="flex items-center gap-2"><input type="checkbox" checked={option.active} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key === option.key ? { ...candidate, active: event.target.checked } : candidate) }))}/> Ativa</label></div>
                      {ingredientsAvailable && <div className="mt-3 rounded-xl bg-gray-50 p-3"><div className="flex items-center justify-between"><p className="text-xs font-black text-gray-600"><HelpLabel helpKey="composition.optionIngredients">Ingredientes consumidos por esta opção</HelpLabel></p><button type="button" onClick={() => addOptionIngredient(group.key, option.key)} className="text-xs font-black text-blue-700">+ Ingrediente</button></div><div className="mt-2 space-y-2">{option.ingredients.map((row, rowIndex) => <div key={`${rowIndex}-${row.ingredientId}`} className="grid gap-2 sm:grid-cols-[1fr_150px_36px]"><select value={row.ingredientId} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key !== option.key ? candidate : { ...candidate, ingredients: candidate.ingredients.map((ingredientRow, ingredientIndex) => ingredientIndex === rowIndex ? { ...ingredientRow, ingredientId: event.target.value } : ingredientRow) }) }))} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs"><option value="">Ingrediente</option>{ingredients.filter((item) => item.active).map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select><input value={row.quantity} onChange={(event) => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key !== option.key ? candidate : { ...candidate, ingredients: candidate.ingredients.map((ingredientRow, ingredientIndex) => ingredientIndex === rowIndex ? { ...ingredientRow, quantity: event.target.value } : ingredientRow) }) }))} inputMode="decimal" placeholder="Qtd." className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs"/><button type="button" onClick={() => setGroups((current) => current.map((item) => item.key !== group.key ? item : { ...item, options: item.options.map((candidate) => candidate.key !== option.key ? candidate : { ...candidate, ingredients: candidate.ingredients.filter((_, ingredientIndex) => ingredientIndex !== rowIndex) }) }))} className="rounded-lg text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button></div>)}</div></div>}
                      </details>
                    </div>)}
                    <button type="button" onClick={() => addOption(group.key)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-700"><Plus className="h-4 w-4" /> Adicionar sabor ou extra</button>
                  </div>
                  <details className="mt-4 rounded-xl border border-gray-200 bg-white p-3"><summary className="cursor-pointer text-xs font-bold text-gray-700">Mais opções</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-600">Texto de ajuda para o cliente<input value={group.description} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, description: event.target.value } : item))} placeholder="Opcional" className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm"/></label><label className="text-xs font-bold text-gray-600">Quantidade incluída no preço (máx. {group.maxSelect})<input type="number" min="0" max={group.maxSelect} value={group.includedQuantity} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, includedQuantity: event.target.value } : item))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm"/></label></div><label className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-600"><input type="checkbox" checked={group.active} onChange={(event) => setGroups((current) => current.map((item) => item.key === group.key ? { ...item, active: event.target.checked } : item))}/> Mostrar esta escolha na loja</label><p className="mt-2 text-xs text-gray-500">Escolha {groupIndex + 1} · aparece nesta ordem.</p></details>
                </details>)}
                {!groups.length && <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Sem sabores ou extras. Clique em “Nova escolha” para começar.</div>}
              </div>
            </section>
            {ingredientsAvailable && <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-sm font-black text-gray-900">Estoque e ingredientes (opcional)</summary>
              <div className="mt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex items-center gap-1.5"><h3 className="font-black text-gray-900">Ficha técnica base</h3><HelpTip helpKey="composition.base" /></div><p className="text-sm text-gray-500">Ingredientes consumidos em cada unidade vendida deste produto.</p></div>
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
              </div>
            </details>}
          </>}
        </div>

        <div className={`${embedded ? "" : "sticky bottom-0"} flex justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:px-6`}><button type="button" onClick={onClose} className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-700">Fechar</button><button type="button" onClick={save} disabled={loading || saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar sabores e extras"}</button></div>
      </div>
    </div>
  )
}
