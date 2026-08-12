"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Plus, X } from "lucide-react"
import {
  validateAndPriceModifierSelection,
} from "@/lib/product-composition"
import type { OrderItemModifier, Product } from "@/lib/types"

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)

const EMPTY_OPTION_IDS: number[] = []

export type ProductCustomization = {
  optionIds: number[]
  unitPrice: number
  modifiers: OrderItemModifier[]
}

export function ProductCustomizer({
  product,
  primaryColor,
  initialOptionIds = EMPTY_OPTION_IDS,
  onClose,
  onConfirm,
}: {
  product: Product | null
  primaryColor?: string
  initialOptionIds?: number[]
  onClose: () => void
  onConfirm: (customization: ProductCustomization) => void
}) {
  const [selected, setSelected] = useState<number[]>(initialOptionIds)
  const [error, setError] = useState("")

  const initialOptionKey = initialOptionIds.join(",")

  useEffect(() => {
    setSelected([...initialOptionIds])
    setError("")
  }, [product?.id, initialOptionKey])

  const groups = useMemo(
    () =>
      (product?.modifierGroups || [])
        .filter((group) => group.active)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [product],
  )

  const pricing = useMemo(
    () =>
      product
        ? validateAndPriceModifierSelection(product, selected)
        : null,
    [product, selected],
  )

  if (!product) return null

  function toggle(groupId: number, optionId: number, maxSelect: number) {
    setError("")
    const group = groups.find((item) => item.id === groupId)
    if (!group) return

    setSelected((current) => {
      const groupOptionIds = new Set(group.options.map((option) => option.id))
      const currentlySelected = current.filter((id) => groupOptionIds.has(id))
      const has = current.includes(optionId)

      if (has) return current.filter((id) => id !== optionId)

      if (maxSelect === 1) {
        return [
          ...current.filter((id) => !groupOptionIds.has(id)),
          optionId,
        ]
      }

      if (currentlySelected.length >= maxSelect) {
        setError(`${group.name}: escolha no máximo ${maxSelect} opção(ões).`)
        return current
      }

      return [...current, optionId]
    })
  }

  function confirm() {
    if (!product) return
    const result = validateAndPriceModifierSelection(product, selected)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onConfirm({
      optionIds: [...selected].sort((a, b) => a - b),
      unitPrice: result.unitPrice,
      modifiers: result.modifiers,
    })
  }

  return (
    <div className="fixed inset-0 z-[94] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
      <button aria-label="Fechar montagem" onClick={onClose} className="absolute inset-0" />
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">Monte do seu jeito</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">{product.name}</h2>
            <p className="mt-1 text-sm text-gray-500">A partir de {money(product.price)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 p-2" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {groups.map((group) => {
            const selectedInGroup = selected.filter((id) =>
              group.options.some((option) => option.id === id),
            ).length
            const minimum = Math.max(group.required ? 1 : 0, group.minSelect)
            return (
              <section key={group.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-gray-900">{group.name}</h3>
                    {group.description && <p className="mt-0.5 text-xs text-gray-500">{group.description}</p>}
                    <p className="mt-1 text-[11px] font-bold text-gray-400">
                      {minimum > 0 ? `Mínimo ${minimum}` : "Opcional"} · máximo {group.maxSelect}
                      {group.includedQuantity > 0 ? ` · ${group.includedQuantity} incluído(s)` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-black text-gray-600">
                    {selectedInGroup}/{group.maxSelect}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.options
                    .filter((option) => option.active)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
                    .map((option) => {
                      const checked = selected.includes(option.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!option.available}
                          onClick={() => toggle(group.id, option.id, group.maxSelect)}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${checked ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-transparent text-white" : "border-gray-300 bg-white"}`}
                            style={checked ? { backgroundColor: primaryColor || "#ea580c" } : undefined}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block text-sm text-gray-900">{option.name}</strong>
                            {option.description && <small className="block text-xs text-gray-500">{option.description}</small>}
                            {!option.available && <small className="block text-xs font-bold text-red-600">Indisponível por estoque</small>}
                          </span>
                          <strong className="whitespace-nowrap text-sm text-gray-800">
                            {option.includedEligible && group.includedQuantity > 0
                              ? option.priceDelta > 0
                                ? `até ${money(option.priceDelta)}`
                                : "Incluído"
                              : option.priceDelta > 0
                                ? `+ ${money(option.priceDelta)}`
                                : "Grátis"}
                          </strong>
                        </button>
                      )
                    })}
                </div>
              </section>
            )
          })}
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}

        <button
          type="button"
          onClick={confirm}
          style={{ backgroundColor: primaryColor || "#ea580c" }}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" />
          Adicionar · {money(pricing && pricing.ok ? pricing.unitPrice : product.price)}
        </button>
      </div>
    </div>
  )
}
