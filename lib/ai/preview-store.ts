import type { Product, StoreSettings } from "@/lib/types"
import type { SetupPlan } from "@/lib/ai/store-setup"

/** Client-only projection: no database write occurs while the administrator reviews. */
export function previewStore(settings: StoreSettings, products: Product[], plan: SetupPlan) {
  const store = Object.fromEntries(Object.entries(plan.store).filter(([, value]) => value !== "" && value !== null).map(([key, value]) => [key === "name" ? "storeName" : key, value]))
  const operations = Object.fromEntries(Object.entries(plan.operations || {}).filter(([, value]) => value !== null && value !== undefined))
  const nextSettings = { ...settings, ...store, ...operations } as StoreSettings
  const edited = products.map((product) => {
    const change = plan.productEdits.find((item) => item.id === product.id)
    if (change) return {
      ...product,
      ...(change.description !== null ? { description: change.description } : {}),
      ...(change.price !== null ? { price: change.price } : {}),
      ...(change.featured !== null ? { featured: change.featured } : {}),
    }
    const generated = plan.products.find((item) => item.name.toLocaleLowerCase("pt-BR") === product.name.toLocaleLowerCase("pt-BR") && item.category.toLocaleLowerCase("pt-BR") === product.category.toLocaleLowerCase("pt-BR"))
    return generated ? { ...product, description: generated.description || product.description, price: generated.price > 0 ? generated.price : product.price, featured: generated.featured } : product
  })
  const now = new Date().toISOString()
  const added = plan.products.filter((item) => !products.some((product) => product.name.toLocaleLowerCase("pt-BR") === item.name.toLocaleLowerCase("pt-BR") && product.category.toLocaleLowerCase("pt-BR") === item.category.toLocaleLowerCase("pt-BR"))).map((item, index): Product => ({
    id: -(index + 1), name: item.name, description: item.description, category: item.category,
    price: item.price, active: item.price > 0, featured: item.featured, trackStock: false,
    stock: 0, minStock: 0, createdAt: now, updatedAt: now,
  }))
  return { settings: nextSettings, products: [...edited, ...added] }
}
