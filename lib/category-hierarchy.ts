import type { Category } from "@/lib/types"

export const CATEGORY_SEPARATOR = " / "

export function parentCategoryName(name: string) {
  const position = name.indexOf(CATEGORY_SEPARATOR)
  return position < 0 ? "" : name.slice(0, position)
}

export function categoryShortName(name: string) {
  const parent = parentCategoryName(name)
  return parent ? name.slice(parent.length + CATEGORY_SEPARATOR.length) : name
}

export function sortedCategories(categories: Category[]) {
  const compare = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })
  return [...categories].sort((a, b) => {
    const rootA = parentCategoryName(a.name) || a.name
    const rootB = parentCategoryName(b.name) || b.name
    return compare(rootA, rootB) || Number(Boolean(parentCategoryName(a.name))) - Number(Boolean(parentCategoryName(b.name))) || compare(a.name, b.name)
  })
}

export function categoryIncludes(parent: string, category: string) {
  return category === parent || category.startsWith(parent + CATEGORY_SEPARATOR)
}
