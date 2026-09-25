"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Minus, Plus, X } from "lucide-react"
import { validateAndPriceModifierSelection } from "@/lib/product-composition"
import type { OrderItemModifier, Product } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const EMPTY_OPTION_IDS: number[] = []

export type ProductCustomization = {
  optionIds: number[]
  quantity: number
  unitPrice: number
  modifiers: OrderItemModifier[]
}

export function ProductCustomizer({ product, primaryColor, initialOptionIds = EMPTY_OPTION_IDS, initialQuantity = 1, onClose, onConfirm }: {
  product: Product | null
  primaryColor?: string
  initialOptionIds?: number[]
  initialQuantity?: number
  onClose: () => void
  onConfirm: (customization: ProductCustomization) => void
}) {
  const [selected, setSelected] = useState<number[]>(initialOptionIds)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState("")
  const initialOptionKey = initialOptionIds.join(",")

  useEffect(() => {
    setSelected([...initialOptionIds])
    setQuantity(initialQuantity)
    setError("")
  }, [product?.id, initialOptionKey, initialQuantity])

  const groups = useMemo(() => (product?.modifierGroups || [])
    .filter((group) => group.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), [product])
  const pricing = useMemo(() => product
    ? validateAndPriceModifierSelection(product, selected, quantity) : null,
  [product, selected, quantity])

  if (!product) return null

  function changeSelection(groupId: number, optionId: number, amount: number) {
    setError("")
    const group = groups.find((item) => item.id === groupId)
    if (!group) return
    setSelected((current) => {
      const groupIds = new Set(group.options.map((option) => option.id))
      const count = current.filter((id) => groupIds.has(id)).length
      if (group.selectionMode === "bundle") {
        if (amount < 0) {
          const index = current.indexOf(optionId)
          return index < 0 ? current : current.filter((_, position) => position !== index)
        }
        if (count >= group.maxSelect * quantity || current.length >= 100) {
          setError(`${group.name}: limite de ${group.maxSelect * quantity} escolhas para ${quantity} unidade(s).`)
          return current
        }
        return [...current, optionId]
      }
      if (current.includes(optionId)) return current.filter((id) => id !== optionId)
      if (group.maxSelect === 1) return [...current.filter((id) => !groupIds.has(id)), optionId]
      if (count >= group.maxSelect) {
        setError(`${group.name}: escolha no máximo ${group.maxSelect} opção(ões).`)
        return current
      }
      return [...current, optionId]
    })
  }

  function confirm() {
    const result = validateAndPriceModifierSelection(product!, selected, quantity)
    if (!result.ok) return setError(result.error)
    onConfirm({
      optionIds: [...selected].sort((a, b) => a - b),
      quantity,
      unitPrice: result.unitPrice,
      modifiers: result.modifiers,
    })
  }

  return <div className="fixed inset-0 z-[94] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
    <button aria-label="Fechar montagem" onClick={onClose} className="absolute inset-0" />
    <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-gray-400">Monte seu pedido</p><h2 className="mt-1 text-2xl font-black text-gray-950">{product.name}</h2><p className="mt-1 text-sm font-bold text-gray-700">{money(product.price)} por unidade</p></div><button type="button" onClick={onClose} className="rounded-xl bg-gray-100 p-2" aria-label="Fechar"><X className="h-5 w-5" /></button></div>
      {(product.image || product.description) && <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">{product.image && <div className="aspect-[16/9] overflow-hidden bg-gray-100"><img src={product.image} alt={product.name} className="h-full w-full object-cover" /></div>}{product.description && <p className="p-4 text-sm leading-relaxed text-gray-600">{product.description}</p>}</div>}
      <div className="mt-5 flex items-center justify-between rounded-2xl bg-gray-50 p-4"><span className="font-bold text-gray-900">Quantidade do produto</span><div className="flex items-center gap-3"><button type="button" aria-label="Diminuir quantidade" onClick={() => {setQuantity((value) => Math.max(1, value - 1)); setError("")}} className="rounded-lg bg-white p-2"><Minus className="h-4 w-4" /></button><strong>{quantity}</strong><button type="button" aria-label="Aumentar quantidade" onClick={() => {setQuantity((value) => Math.min(100, value + 1)); setError("")}} className="rounded-lg bg-white p-2"><Plus className="h-4 w-4" /></button></div></div>
      <div className="mt-5 space-y-4">{groups.map((group) => {
        const count = selected.filter((id) => group.options.some((option) => option.id === id)).length
        const minimum = Math.max(group.required ? 1 : 0, group.minSelect)
        const maximum = group.maxSelect * (group.selectionMode === "bundle" ? quantity : 1)
        return <details key={group.id} open className="rounded-2xl border border-gray-200 p-4"><summary className="cursor-pointer font-black text-gray-900">{group.name} <span className="ml-2 text-xs font-normal text-gray-500">{count}/{maximum}</span></summary>{group.description && <p className="mt-1 text-xs text-gray-500">{group.description}</p>}<p className="mt-1 text-xs font-semibold text-gray-500">{group.selectionMode === "bundle" ? `Escolha de ${minimum} a ${maximum} sabores para ${quantity} unidade(s). Pode repetir o mesmo sabor.` : `${minimum ? `Mínimo ${minimum}` : "Opcional"} · máximo ${maximum}`}</p><div className="mt-3 space-y-2">{group.options.filter((option) => option.active).sort((a,b) => a.sortOrder - b.sortOrder || a.id - b.id).map((option) => {
          const chosen = selected.filter((id) => id === option.id).length
          return <div key={option.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5"><div className="min-w-0 flex-1"><strong className="text-sm text-gray-900">{option.name}</strong>{option.description && <small className="block text-xs text-gray-500">{option.description}</small>}{!option.available && <small className="block text-xs font-bold text-red-600">Indisponível por estoque</small>}{option.priceDelta > 0 && <small className="block text-xs text-gray-500">+ {money(option.priceDelta)}</small>}</div>{group.selectionMode === "bundle" ? <div className="flex items-center gap-2"><button type="button" aria-label={`Diminuir ${option.name}`} disabled={!chosen} onClick={() => changeSelection(group.id, option.id, -1)} className="rounded-lg bg-gray-100 p-2 disabled:opacity-40"><Minus className="h-4 w-4" /></button><strong className="w-5 text-center text-sm">{chosen}</strong><button type="button" aria-label={`Adicionar ${option.name}`} disabled={!option.available || count >= maximum} onClick={() => changeSelection(group.id, option.id, 1)} className="rounded-lg bg-gray-100 p-2 disabled:opacity-40"><Plus className="h-4 w-4" /></button></div> : <button type="button" disabled={!option.available} onClick={() => changeSelection(group.id, option.id, 1)} aria-label={`${chosen ? "Remover" : "Escolher"} ${option.name}`} className={`rounded-lg border p-2 disabled:opacity-40 ${chosen ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}>{chosen ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</button>}</div>
        })}</div></details>
      })}</div>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
      <button type="button" onClick={confirm} style={{ backgroundColor: primaryColor || "#ea580c" }} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-white"><Plus className="h-4 w-4" /> Adicionar {quantity} · {money((pricing && pricing.ok ? pricing.unitPrice : product.price) * quantity)}</button>
    </div>
  </div>
}
