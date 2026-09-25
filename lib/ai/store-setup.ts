import { createHmac, timingSafeEqual } from "node:crypto"
import type { PoolClient } from "pg"
import { getPostgresPool } from "@/lib/postgres"
import { invalidatePublicStoreCache } from "@/lib/public-store-db"

export type SetupPlan = {
  store: { name: string; slogan: string; welcomeTitle: string; welcomeText: string; aboutTitle: string; aboutText: string; primaryColor: string; secondaryColor: string; phone: string; whatsapp: string; openingHours: string; clientAccountsEnabled: boolean | null }
  categories: string[]
  groups: Array<{ name: string; description: string; required: boolean; minSelect: number; maxSelect: number; selectionMode: "unique" | "bundle"; options: Array<{ name: string; priceDelta: number }> }>
  products: Array<{ name: string; description: string; category: string; price: number; featured: boolean; groups: string[]; suggestions: string[] }>
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : "" }
function unique(values: string[]) { return [...new Set(values.map((value) => value.toLocaleLowerCase("pt-BR")))].length === values.length }
function integer(value: unknown, max: number) { const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > max) throw new Error("Quantidade inválida no plano."); return n }
function money(value: unknown) { const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 100000) throw new Error("Preço inválido no plano."); return Number(n.toFixed(2)) }
function color(value: unknown, fallback: string) { const candidate = clean(value, 7); return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : fallback }

export function validateSetupPlan(raw: unknown): SetupPlan {
  if (!raw || typeof raw !== "object") throw new Error("A IA não gerou um plano válido.")
  const input = raw as Record<string, unknown>
  const store = (input.store || {}) as Record<string, unknown>
  if (!Array.isArray(input.categories) || input.categories.length > 20 || !Array.isArray(input.groups) || input.groups.length > 20 || !Array.isArray(input.products) || input.products.length > 50) throw new Error("O plano excede o limite de 20 categorias, 20 grupos ou 50 produtos.")
  const categories = input.categories.map((v) => clean(v, 100))
  if (categories.some((v) => !v) || !unique(categories)) throw new Error("Revise os nomes das categorias.")
  const groups = input.groups.map((v) => {
    const item = v as Record<string, unknown>
    if (!item || !Array.isArray(item.options) || item.options.length < 1 || item.options.length > 60) throw new Error("Grupo sem opções ou com opções demais.")
    const name = clean(item.name, 120)
    const options = item.options.map((o) => ({ name: clean((o as Record<string, unknown>)?.name, 120), priceDelta: money((o as Record<string, unknown>)?.priceDelta ?? 0) }))
    const minSelect = integer(item.minSelect, 100)
    const maxSelect = integer(item.maxSelect, 100)
    const required = item.required === true
    const selectionMode = item.selectionMode === "bundle" ? "bundle" as const : "unique" as const
    if (!name || options.some((o) => !o.name) || !unique(options.map((o) => o.name))) throw new Error(`Revise as opções do grupo ${name || "sem nome"}.`)
    if (!maxSelect || minSelect > maxSelect || (required && minSelect < 1) || (selectionMode === "unique" && minSelect > options.length) || (selectionMode === "bundle" && options.some((o) => o.priceDelta !== 0))) throw new Error(`Revise mínimo, máximo e preço dos sabores em ${name}.`)
    return { name, description: clean(item.description, 500), required, minSelect, maxSelect, selectionMode, options }
  })
  if (!unique(groups.map((g) => g.name))) throw new Error("Há grupos repetidos.")
  const products = input.products.map((v) => {
    const item = v as Record<string, unknown>
    if (!item || !Array.isArray(item.groups) || !Array.isArray(item.suggestions)) throw new Error("Produto incompleto.")
    const product = { name: clean(item.name, 120), description: clean(item.description, 500), category: clean(item.category, 100), price: money(item.price), featured: item.featured === true, groups: item.groups.map((x) => clean(x, 120)), suggestions: item.suggestions.map((x) => clean(x, 120)) }
    if (!product.name || !categories.some((c) => c.toLowerCase() === product.category.toLowerCase()) || product.groups.length > 8 || product.suggestions.length > 6 || !unique(product.groups) || !unique(product.suggestions) || product.groups.some((g) => !groups.some((x) => x.name.toLowerCase() === g.toLowerCase()))) throw new Error(`Revise o produto ${product.name || "sem nome"}.`)
    return product
  })
  if (!unique(products.map((p) => p.name))) throw new Error("Há produtos com o mesmo nome; diferencie os nomes para configurar as sugestões.")
  const allProducts = new Set(products.map((p) => p.name.toLowerCase()))
  if (products.some((p) => p.suggestions.some((s) => !allProducts.has(s.toLowerCase()) || s.toLowerCase() === p.name.toLowerCase()))) throw new Error("Uma sugestão aponta para produto ausente ou para si mesmo.")
  return {
    store: { name: clean(store.name, 120), slogan: clean(store.slogan, 200), welcomeTitle: clean(store.welcomeTitle, 150), welcomeText: clean(store.welcomeText, 500), aboutTitle: clean(store.aboutTitle, 150), aboutText: clean(store.aboutText, 1500), primaryColor: color(store.primaryColor, "#d96d00"), secondaryColor: color(store.secondaryColor, "#2f1c13"), phone: clean(store.phone, 30), whatsapp: clean(store.whatsapp, 30), openingHours: clean(store.openingHours, 200), clientAccountsEnabled: typeof store.clientAccountsEnabled === "boolean" ? store.clientAccountsEnabled : null },
    categories, groups, products,
  }
}

function secret() { const value = process.env.SESSION_SECRET?.trim(); if (!value) throw new Error("SESSION_SECRET não configurado."); return value }
export function signSetupPreview(organizationId: string, userId: string, expiresAt: number) {
  const payload = `${organizationId}:${userId}:${expiresAt}`
  return `${expiresAt}.${createHmac("sha256", secret()).update(`setup:${payload}`).digest("hex")}`
}
export function verifySetupPreview(token: string, organizationId: string, userId: string) {
  const match = /^(\d{13})\.([0-9a-f]{64})$/.exec(token)
  if (!match || Number(match[1]) < Date.now() || Number(match[1]) > Date.now() + 31 * 60_000) return false
  const expected = signSetupPreview(organizationId, userId, Number(match[1])).split(".")[1]
  return timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(expected, "hex"))
}

async function nextId(client: PoolClient, table: "sf_categories" | "sf_products" | "sf_modifier_groups" | "sf_modifier_options", org: string) {
  const r = await client.query<{ id: number }>(`SELECT COALESCE(MAX(id), 0)::int + 1 AS id FROM ${table} WHERE organization_id=$1`, [org])
  return r.rows[0].id
}

export async function applySetupPlan(org: string, plan: SetupPlan) {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`saborflow-catalog:${org}`])
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`saborflow-food-composition:${org}`])
    const settings = await client.query<{ settings: Record<string, unknown> }>("SELECT settings FROM sf_organization_settings WHERE organization_id=$1 FOR UPDATE", [org])
    if (!settings.rows[0]) throw new Error("Configurações da empresa não encontradas.")
    // Só os campos mostrados na prévia são alterados; fotos e dados operacionais continuam sob controle do administrador.
    const patch = Object.fromEntries(Object.entries(plan.store).filter(([, value]) => value !== "" && value !== null))
    await client.query("UPDATE sf_organization_settings SET settings=settings || $2::jsonb, updated_at=now() WHERE organization_id=$1", [org, JSON.stringify(patch)])
    if (plan.store.name) await client.query("UPDATE sf_organizations SET trade_name=$2, updated_at=now() WHERE id=$1", [org, plan.store.name])

    const categoryIds = new Map<string, number>()
    for (const name of plan.categories) {
      const old = await client.query<{ id: number }>("SELECT id FROM sf_categories WHERE organization_id=$1 AND lower(name)=lower($2)", [org, name])
      const id = old.rows[0]?.id ?? await nextId(client, "sf_categories", org)
      if (!old.rows[0]) await client.query("INSERT INTO sf_categories (organization_id,id,name,active,sort_order) VALUES ($1,$2,$3,true,$2)", [org, id, name])
      categoryIds.set(name.toLowerCase(), id)
    }
    const groupIds = new Map<string, number>()
    for (const [index, group] of plan.groups.entries()) {
      // Uma versão antiga com o mesmo nome pode ter limites diferentes. Só reutilizamos a que
      // realmente corresponde à prévia; os produtos de outras lojas/combos não são alterados.
      const candidates = await client.query<{ id: number; name: string; required: boolean; min_select: number; max_select: number; selection_mode: string; active: boolean }>(
        "SELECT id,name,required,min_select,max_select,selection_mode,active FROM sf_modifier_groups WHERE organization_id=$1 AND (lower(name)=lower($2) OR left(lower(name),length(lower($3)))=lower($3)) ORDER BY id",
        [org,group.name,`${group.name} · IA`],
      )
      let matchingId: number | undefined
      for (const candidate of candidates.rows) {
        if (!candidate.active || candidate.required !== group.required || candidate.min_select !== group.minSelect || candidate.max_select !== group.maxSelect || candidate.selection_mode !== group.selectionMode) continue
        const options = await client.query<{ name: string; price_delta: string | number; active: boolean }>(
          "SELECT name,price_delta,active FROM sf_modifier_options WHERE organization_id=$1 AND group_id=$2 ORDER BY sort_order,id", [org,candidate.id],
        )
        if (options.rows.length === group.options.length && options.rows.every((option, position) => option.active && option.name.toLowerCase() === group.options[position].name.toLowerCase() && Number(option.price_delta) === group.options[position].priceDelta)) {
          matchingId = candidate.id
          break
        }
      }
      const id = matchingId ?? await nextId(client, "sf_modifier_groups", org)
      if (!matchingId) {
        const name = group.name
        await client.query("INSERT INTO sf_modifier_groups (organization_id,id,name,description,required,min_select,max_select,included_quantity,active,sort_order,selection_mode) VALUES ($1,$2,$3,$4,$5,$6,$7,0,true,$8,$9)", [org,id,name,group.description,group.required,group.minSelect,group.maxSelect,index,group.selectionMode])
        for (const [sort, option] of group.options.entries()) {
          const optionId = await nextId(client, "sf_modifier_options", org)
          await client.query("INSERT INTO sf_modifier_options (organization_id,id,group_id,name,price_delta,included_eligible,active,sort_order) VALUES ($1,$2,$3,$4,$5,false,true,$6)", [org,optionId,id,option.name,option.priceDelta,sort])
        }
      }
      groupIds.set(group.name.toLowerCase(), id)
    }
    const productIds = new Map<string, number>()
    let created = 0
    for (const product of plan.products) {
      const categoryId = categoryIds.get(product.category.toLowerCase())!
      const old = await client.query<{ id: number }>("SELECT id FROM sf_products WHERE organization_id=$1 AND category_id=$2 AND lower(name)=lower($3) ORDER BY id LIMIT 1", [org,categoryId,product.name])
      const id = old.rows[0]?.id ?? await nextId(client, "sf_products", org)
      if (!old.rows[0]) {
        await client.query("INSERT INTO sf_products (organization_id,id,category_id,name,description,price,active,featured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [org,id,categoryId,product.name,product.description,product.price,product.price > 0,product.featured])
        created++
      } else {
        // A confirmação do administrador aplica a prévia ao produto existente.
        // Preservamos imagem, estoque e demais dados que não foram informados à IA.
        await client.query(
          `UPDATE sf_products SET
             description=CASE WHEN $3 <> '' THEN $3 ELSE description END,
             price=CASE WHEN $4 > 0 THEN $4 ELSE price END,
             featured=$5,
             active=CASE WHEN $4 > 0 OR price > 0 THEN true ELSE active END,
             updated_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [org,id,product.description,product.price,product.featured],
        )
      }
      for (const [sort, name] of product.groups.entries()) {
        const selectedGroupId = groupIds.get(name.toLowerCase())!
        await client.query(
          `DELETE FROM sf_product_modifier_groups links USING sf_modifier_groups old
           WHERE links.organization_id=$1 AND links.product_id=$2
             AND old.organization_id=links.organization_id AND old.id=links.group_id
             AND links.group_id <> $3
             AND (lower(old.name)=lower($4) OR left(lower(old.name),length(lower($5)))=lower($5))`,
          [org,id,selectedGroupId,name,`${name} · IA`],
        )
        await client.query(
          `INSERT INTO sf_product_modifier_groups (organization_id,product_id,group_id,sort_order)
           VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id,product_id,group_id)
           DO UPDATE SET sort_order=EXCLUDED.sort_order`,
          [org,id,selectedGroupId,sort],
        )
      }
      productIds.set(product.name.toLowerCase(), id)
    }
    for (const product of plan.products) {
      const productId = productIds.get(product.name.toLowerCase())!
      for (const [sort, suggestion] of product.suggestions.entries()) await client.query("INSERT INTO sf_product_recommendations (organization_id,product_id,recommended_product_id,sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id,product_id,recommended_product_id) DO UPDATE SET sort_order=EXCLUDED.sort_order", [org,productId,productIds.get(suggestion.toLowerCase()),sort])
    }
    await client.query("INSERT INTO sf_catalog_state (organization_id,ready,source,categories_count,products_count,updated_at) SELECT $1,true,'ai-setup',(SELECT count(*) FROM sf_categories WHERE organization_id=$1),(SELECT count(*) FROM sf_products WHERE organization_id=$1),now() ON CONFLICT (organization_id) DO UPDATE SET ready=true,source='ai-setup',categories_count=EXCLUDED.categories_count,products_count=EXCLUDED.products_count,updated_at=now()", [org])
    await client.query("INSERT INTO sf_food_composition_state (organization_id,ready,source,modifier_groups_count,modifier_options_count,updated_at) SELECT $1,true,'ai-setup',(SELECT count(*) FROM sf_modifier_groups WHERE organization_id=$1),(SELECT count(*) FROM sf_modifier_options WHERE organization_id=$1),now() ON CONFLICT (organization_id) DO UPDATE SET ready=true,source='ai-setup',modifier_groups_count=EXCLUDED.modifier_groups_count,modifier_options_count=EXCLUDED.modifier_options_count,updated_at=now()", [org])
    const visible = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM sf_products WHERE organization_id=$1 AND id=ANY($2::int[]) AND active=true", [org,[...productIds.values()]],
    )
    await client.query("COMMIT")
    invalidatePublicStoreCache(org)
    return { createdProducts: created, updatedProducts: plan.products.length - created, visibleProducts: visible.rows[0]?.count ?? 0 }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}
