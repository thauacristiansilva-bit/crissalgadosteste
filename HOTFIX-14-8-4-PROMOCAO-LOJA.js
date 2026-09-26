const fs = require("fs")
const path = require("path")

const publicStoreFile = path.join("lib", "public-store-db.ts")
const storefrontFile = path.join("components", "store", "storefront.tsx")

for (const file of [publicStoreFile, storefrontFile]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${file}`)
  }
}

function count(text, needle) {
  return text.split(needle).length - 1
}

function replaceExact(text, oldText, newText, label) {
  const found = count(text, oldText)
  if (found !== 1) {
    throw new Error(
      `${label}: esperado 1 trecho, encontrado(s) ${found}. Nenhum arquivo foi alterado.`
    )
  }
  return text.replace(oldText, newText)
}

const originalPublicStore = fs.readFileSync(publicStoreFile, "utf8")
const originalStorefront = fs.readFileSync(storefrontFile, "utf8")

if (
  originalPublicStore.includes("PROMOTIONS_LIVE_REFRESH_1484") &&
  originalStorefront.includes("productPromotionDisplayPrice")
) {
  console.log("HOTFIX 14.8.4 ja esta aplicado.")
  process.exit(0)
}

let nextPublicStore = originalPublicStore
let nextStorefront = originalStorefront

// ============================================================
// 1) PUBLIC STORE
// Promocao nao pode depender do snapshot antigo em memoria.
// O catalogo continua em cache, mas as promocoes sao lidas ao vivo.
// ============================================================

const oldPublicReturn = `  const { promotions, ...publicSnapshot } = snapshot

  return {
    ...publicSnapshot,
    products: applyActivePromotionsToProducts(
      snapshot.products,
      promotions,
      snapshot.settings.timeZone,
    ),
    // Horario e promocao ativa continuam sendo calculados a cada request,
    // mesmo quando o catalogo esta em cache.
    openNow: isStoreOpenNow(snapshot.settings),
  }
`

const newPublicReturn = `  // PROMOTIONS_LIVE_REFRESH_1484
  // O snapshot do catalogo continua rapido, mas promocao e uma informacao
  // sensivel a horario e alteracoes administrativas. Por isso ela e lida
  // novamente em cada renderizacao publica, inclusive entre replicas.
  const livePromotions =
    await runWithTenantRlsScope(
      [organization.id],
      undefined,
      () =>
        getTenantProductPromotions(
          organization.id,
        ),
      "public-store",
    ).catch(
      () => snapshot.promotions,
    )

  const {
    promotions: _cachedPromotions,
    ...publicSnapshot
  } = snapshot

  return {
    ...publicSnapshot,
    products:
      applyActivePromotionsToProducts(
        snapshot.products,
        livePromotions,
        snapshot.settings.timeZone,
      ),
    // Horario e promocao ativa continuam sendo calculados a cada request,
    // mesmo quando o catalogo esta em cache.
    openNow:
      isStoreOpenNow(
        snapshot.settings,
      ),
  }
`

nextPublicStore = replaceExact(
  nextPublicStore,
  oldPublicReturn,
  newPublicReturn,
  "Public store: tornar promocoes atuais"
)

// ============================================================
// 2) STOREFRONT
// Atualiza quando o cliente volta para a aba e periodicamente.
// ============================================================

const storeClockEffect = `  useEffect(() => {
    const update = () => {
      setIsOpen(isStoreOpenNow(settings))
      setPromotionClock(Date.now())
    }
    update()
    const id = window.setInterval(update, 30000)
    return () => window.clearInterval(id)
  }, [settings])
`

const storeClockWithRefresh = `  useEffect(() => {
    const update = () => {
      setIsOpen(isStoreOpenNow(settings))
      setPromotionClock(Date.now())
    }
    update()
    const id = window.setInterval(update, 30000)
    return () => window.clearInterval(id)
  }, [settings])

  useEffect(() => {
    const refreshPromotions = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        router.refresh()
      }
    }

    window.addEventListener(
      "focus",
      refreshPromotions,
    )
    document.addEventListener(
      "visibilitychange",
      refreshPromotions,
    )

    const id = window.setInterval(
      refreshPromotions,
      30000,
    )

    return () => {
      window.removeEventListener(
        "focus",
        refreshPromotions,
      )
      document.removeEventListener(
        "visibilitychange",
        refreshPromotions,
      )
      window.clearInterval(id)
    }
  }, [router])
`

nextStorefront = replaceExact(
  nextStorefront,
  storeClockEffect,
  storeClockWithRefresh,
  "Storefront: atualizar promocoes ao vivo"
)

// ============================================================
// 3) Promocoes destacadas aparecem primeiro.
// ============================================================

const oldFiltered = `  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return products.filter((p) => p.active).filter((p) => category === "Todos" || p.category === category).filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "pt-BR")) }, [products, search, category])
`

const newFiltered = `  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase()

    return products
      .filter((p) => p.active)
      .filter(
        (p) =>
          category === "Todos" ||
          p.category === category,
      )
      .filter(
        (p) =>
          !q ||
          p.name
            .toLowerCase()
            .includes(q) ||
          p.description
            .toLowerCase()
            .includes(q),
      )
      .sort(
        (a, b) =>
          Number(
            Boolean(
              b.promotion?.highlight,
            ),
          ) -
            Number(
              Boolean(
                a.promotion?.highlight,
              ),
            ) ||
          Number(
            Boolean(b.promotion),
          ) -
            Number(
              Boolean(a.promotion),
            ) ||
          Number(b.featured) -
            Number(a.featured) ||
          a.name.localeCompare(
            b.name,
            "pt-BR",
          ),
      )
  }, [products, search, category])
`

nextStorefront = replaceExact(
  nextStorefront,
  oldFiltered,
  newFiltered,
  "Storefront: priorizar promocoes nos destaques"
)

// ============================================================
// 4) A oferta deve ser VISIVEL mesmo se o cliente ainda nao escolheu
//    "Para agora" ou uma data de agendamento.
//    O preco do carrinho continua respeitando a regra do timing.
// ============================================================

const oldPriceFunction = `  function productPriceForTiming(product: Product, timing: Checkout["timing"]) {
    const promotion = product.promotion
    if (!promotion) return product.price

    const validUntil =
      new Date(
        promotion.validUntil,
      ).getTime()

    if (
      Number.isFinite(
        validUntil,
      ) &&
      validUntil <= promotionClock
    ) {
      return product.price
    }

    if (timing === "now") {
      return Math.min(
        product.price,
        promotion.promotionalPrice,
      )
    }

    if (
      timing === "scheduled" &&
      checkout.scheduleDate &&
      checkout.scheduleDate ===
        scheduleMinDate
    ) {
      return Math.min(
        product.price,
        promotion.promotionalPrice,
      )
    }

    return product.price
  }
`

const newPriceFunction = `  function productPromotionDisplayPrice(
    product: Product,
  ) {
    const promotion =
      product.promotion

    if (!promotion) {
      return product.price
    }

    const validUntil =
      new Date(
        promotion.validUntil,
      ).getTime()

    if (
      Number.isFinite(
        validUntil,
      ) &&
      validUntil <= promotionClock
    ) {
      return product.price
    }

    return Math.min(
      product.price,
      promotion.promotionalPrice,
    )
  }

  function productPriceForTiming(product: Product, timing: Checkout["timing"]) {
    const promotionalPrice =
      productPromotionDisplayPrice(
        product,
      )

    if (
      promotionalPrice >=
      product.price
    ) {
      return product.price
    }

    if (timing === "now") {
      return promotionalPrice
    }

    if (
      timing === "scheduled" &&
      checkout.scheduleDate &&
      checkout.scheduleDate ===
        scheduleMinDate
    ) {
      return promotionalPrice
    }

    return product.price
  }
`

nextStorefront = replaceExact(
  nextStorefront,
  oldPriceFunction,
  newPriceFunction,
  "Storefront: separar preco exibido do preco do checkout"
)

const oldCardCondition = `{product.promotion && productPriceForTiming(product, checkout.timing) < product.price ? (`
const newCardCondition = `{product.promotion && productPromotionDisplayPrice(product) < product.price ? (`

nextStorefront = replaceExact(
  nextStorefront,
  oldCardCondition,
  newCardCondition,
  "Storefront: mostrar promocao ativa no card"
)

const oldCardPrice = `{money(productPriceForTiming(product, checkout.timing))}`
const newCardPrice = `{money(productPromotionDisplayPrice(product))}`

nextStorefront = replaceExact(
  nextStorefront,
  oldCardPrice,
  newCardPrice,
  "Storefront: mostrar preco promocional no card"
)

// ============================================================
// 5) Deixa a regra clara para o cliente.
// ============================================================

const oldHighlight = `{product.promotion.highlight && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">{product.promotion.label || "Oferta"}</span>}`
const newHighlight = `{product.promotion.highlight && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">{product.promotion.label || "Oferta"} · hoje</span>}`

nextStorefront = replaceExact(
  nextStorefront,
  oldHighlight,
  newHighlight,
  "Storefront: identificar oferta valida hoje"
)

// ============================================================
// 6) Validacoes antes de gravar.
// ============================================================

const validations = [
  [nextPublicStore, "PROMOTIONS_LIVE_REFRESH_1484", "promocao publica atualizada"],
  [nextPublicStore, "livePromotions", "consulta ao vivo"],
  [nextStorefront, "productPromotionDisplayPrice", "preco de exibicao"],
  [nextStorefront, "router.refresh()", "refresh automatico"],
  [nextStorefront, "promotion?.highlight", "prioridade dos destaques"],
  [nextStorefront, "· hoje", "badge hoje"],
]

for (const [content, signal, label] of validations) {
  if (!content.includes(signal)) {
    throw new Error(
      `Validacao falhou: ${label}. Nenhum arquivo foi alterado.`
    )
  }
}

// ============================================================
// 7) Backups e gravacao.
// ============================================================

fs.copyFileSync(
  publicStoreFile,
  `${publicStoreFile}.bak1484`,
)
fs.copyFileSync(
  storefrontFile,
  `${storefrontFile}.bak1484`,
)

fs.writeFileSync(
  publicStoreFile,
  nextPublicStore,
  "utf8",
)
fs.writeFileSync(
  storefrontFile,
  nextStorefront,
  "utf8",
)

console.log("")
console.log("==============================================")
console.log("HOTFIX 14.8.4 APLICADO")
console.log("==============================================")
console.log("- Promocoes publicas deixam de depender do snapshot antigo")
console.log("- Cliente atualiza promocao ao voltar para a aba")
console.log("- Atualizacao automatica a cada 30 segundos")
console.log("- Produto em promocao fica no topo quando Destaque estiver ativo")
console.log("- Oferta ativa aparece no card mesmo antes de escolher o horario")
console.log("- Carrinho continua cobrando promocao somente para agora ou hoje")
console.log("- Agendamento para outro dia continua com preco normal")
console.log("")
console.log("Backups .bak1484 criados.")
console.log("Agora execute: npm run build")
