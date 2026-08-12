import type {
  OrderItemModifier,
  Product,
  ProductModifierGroup,
} from "@/lib/types"

export function productHasModifiers(product: Product) {
  return Boolean(
    product.modifierGroups?.some(
      (group) => group.active && group.options.some((option) => option.active),
    ),
  )
}

export function modifierSelectionKey(productId: number, optionIds: number[]) {
  const normalized = [...new Set(optionIds.map(Number).filter(Number.isFinite))]
    .sort((a, b) => a - b)
  return `${productId}:${normalized.join("-")}`
}

export function validateAndPriceModifierSelection(
  product: Pick<Product, "price" | "modifierGroups">,
  optionIds: number[],
) {
  const groups = (product.modifierGroups || [])
    .filter((group) => group.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)

  const requested = [...new Set(optionIds.map(Number))]
  const requestedSet = new Set(requested)
  const known = new Set<number>()
  const modifiers: OrderItemModifier[] = []
  let modifierTotal = 0

  for (const group of groups) {
    const options = group.options
      .filter((option) => option.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)

    const selected = options.filter((option) => requestedSet.has(option.id))

    selected.forEach((option) => known.add(option.id))

    const minimum = Math.max(group.required ? 1 : 0, group.minSelect)
    if (selected.length < minimum) {
      return {
        ok: false as const,
        error: `${group.name}: escolha pelo menos ${minimum} opção(ões).`,
      }
    }

    if (selected.length > group.maxSelect) {
      return {
        ok: false as const,
        error: `${group.name}: escolha no máximo ${group.maxSelect} opção(ões).`,
      }
    }

    const unavailable = selected.find((option) => !option.available)
    if (unavailable) {
      return {
        ok: false as const,
        error: `${unavailable.name} está indisponível no momento.`,
      }
    }

    let includedRemaining = Math.max(0, group.includedQuantity)

    for (const option of selected) {
      const included = option.includedEligible && includedRemaining > 0
      if (included) includedRemaining -= 1
      const charged = included ? 0 : Math.max(0, Number(option.priceDelta || 0))
      modifierTotal += charged
      modifiers.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: Number(charged.toFixed(2)),
        included,
      })
    }
  }

  const unknown = requested.find((optionId) => !known.has(optionId))
  if (unknown !== undefined) {
    return {
      ok: false as const,
      error: "Uma das opções selecionadas não pertence a este produto.",
    }
  }

  const modifierPrice = Number(modifierTotal.toFixed(2))
  return {
    ok: true as const,
    modifierPrice,
    unitPrice: Number((Number(product.price) + modifierPrice).toFixed(2)),
    modifiers,
  }
}

export function selectedOptionsForGroup(
  group: ProductModifierGroup,
  optionIds: number[],
) {
  const selected = new Set(optionIds)
  return group.options.filter((option) => selected.has(option.id))
}
