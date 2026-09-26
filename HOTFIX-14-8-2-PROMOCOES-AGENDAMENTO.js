const fs = require("fs")
const path = require("path")

const files = {
  dashboard: path.join("components", "admin", "admin-dashboard.tsx"),
  marketing: path.join("components", "admin", "marketing-panel.tsx"),
  promotions: path.join("lib", "promotions-db.ts"),
  storefront: path.join("components", "store", "storefront.tsx"),
}

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${file}`)
  }
}

function count(text, needle) {
  if (!needle) return 0
  return text.split(needle).length - 1
}

function replaceExact(text, oldText, newText, label, expected = 1) {
  const found = count(text, oldText)
  if (found !== expected) {
    throw new Error(
      `${label}: esperado ${expected} trecho(s), encontrado(s) ${found}. Nenhum arquivo foi alterado.`
    )
  }
  return text.replace(oldText, newText)
}

const original = {
  dashboard: fs.readFileSync(files.dashboard, "utf8"),
  marketing: fs.readFileSync(files.marketing, "utf8"),
  promotions: fs.readFileSync(files.promotions, "utf8"),
  storefront: fs.readFileSync(files.storefront, "utf8"),
}

if (
  original.promotions.includes("PROMO_SCHEDULE_SAME_DAY_1482") &&
  original.dashboard.includes("MarketingPanel products={products}")
) {
  console.log("HOTFIX 14.8.2 ja esta aplicado.")
  process.exit(0)
}

const next = { ...original }

// ============================================================
// 1) ADMIN: usar os produtos que ja estao carregados no dashboard
// ============================================================

next.dashboard = replaceExact(
  next.dashboard,
  '{section === "marketing" && <MarketingPanel coupons={coupons} customers={customers} settings={settings} onSettingsChanged={setSettings} />}',
  '{section === "marketing" && <MarketingPanel products={products} coupons={coupons} customers={customers} settings={settings} onSettingsChanged={setSettings} />}',
  "Dashboard: passar produtos ao Marketing"
)

next.marketing = replaceExact(
  next.marketing,
`import type {
  Coupon,
  CustomerSummary,
  ProductPromotion,
  StoreSettings,
} from "@/lib/types"
`,
`import type {
  Coupon,
  CustomerSummary,
  Product,
  ProductPromotion,
  StoreSettings,
} from "@/lib/types"
`,
  "Marketing: importar Product"
)

next.marketing = replaceExact(
  next.marketing,
`type PromotionProduct = {
  id: number
  name: string
  category: string
  price: number
  active: boolean
}
`,
`type PromotionProduct = {
  id: number
  name: string
  category: string
  price: number
  active: boolean
}

function toPromotionProducts(
  products: Product[],
): PromotionProduct[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: Number(product.price),
    active: product.active,
  }))
}
`,
  "Marketing: criar adaptador de produtos"
)

next.marketing = replaceExact(
  next.marketing,
`export function MarketingPanel({
  coupons: initialCoupons,
  customers,
  settings,
  onSettingsChanged,
}: {
  coupons: Coupon[]
  customers: CustomerSummary[]
  settings: StoreSettings
  onSettingsChanged: (
    settings: StoreSettings,
  ) => void
}) {
`,
`export function MarketingPanel({
  products: dashboardProducts,
  coupons: initialCoupons,
  customers,
  settings,
  onSettingsChanged,
}: {
  products: Product[]
  coupons: Coupon[]
  customers: CustomerSummary[]
  settings: StoreSettings
  onSettingsChanged: (
    settings: StoreSettings,
  ) => void
}) {
`,
  "Marketing: receber produtos do dashboard"
)

next.marketing = replaceExact(
  next.marketing,
`  const [promotionProducts, setPromotionProducts] =
    useState<PromotionProduct[]>([])
`,
`  const [promotionProducts, setPromotionProducts] =
    useState<PromotionProduct[]>(
      () =>
        toPromotionProducts(
          dashboardProducts,
        ),
    )
`,
  "Marketing: iniciar seletor com produtos do dashboard"
)

next.marketing = replaceExact(
  next.marketing,
`        setPromotionProducts(
          Array.isArray(
            data.products,
          )
            ? data.products
            : [],
        )
`,
`        const apiProducts =
          Array.isArray(
            data.products,
          )
            ? data.products
            : []

        setPromotionProducts(
          apiProducts.length
            ? apiProducts
            : toPromotionProducts(
                dashboardProducts,
              ),
        )
`,
  "Marketing: fallback quando API nao retornar produtos"
)

next.marketing = replaceExact(
  next.marketing,
`  const selectedProduct =
    promotionProducts.find(
      (product) =>
        product.id ===
        Number(
          promotionDraft.productId,
        ),
    ) || null

  useEffect(() => {
`,
`  const selectedProduct =
    promotionProducts.find(
      (product) =>
        product.id ===
        Number(
          promotionDraft.productId,
        ),
    ) || null

  useEffect(() => {
    const dashboardList =
      toPromotionProducts(
        dashboardProducts,
      )

    if (dashboardList.length) {
      setPromotionProducts(
        dashboardList,
      )
    }
  }, [dashboardProducts])

  useEffect(() => {
`,
  "Marketing: sincronizar produtos do dashboard"
)

next.marketing = replaceExact(
  next.marketing,
`            <h2 className="mt-1 text-lg font-black text-gray-950">
              Promoção somente para pedido imediato
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              O preço promocional vale apenas quando o cliente escolhe
              <strong> Para agora</strong>. Qualquer agendamento,
              inclusive para mais tarde no mesmo dia, volta automaticamente
              ao preço normal. O servidor valida essa regra novamente antes
              de criar o pedido.
            </p>
`,
`            <h2 className="mt-1 text-lg font-black text-gray-950">
              Promoção imediata ou agendada para o mesmo dia
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              Enquanto a promoção estiver ativa, o cliente pode pedir
              <strong> Para agora</strong> ou agendar um horário
              <strong> para o mesmo dia</strong>. Agendamentos para outro
              dia usam automaticamente o preço normal. O servidor confere
              novamente a promoção e a data antes de criar o pedido.
            </p>
`,
  "Marketing: atualizar regra exibida"
)

// ============================================================
// 2) BACKEND: promocao pode ser usada em agendamento do mesmo dia
//    SOMENTE se estiver ativa no momento em que o pedido e enviado.
// ============================================================

next.promotions = replaceExact(
  next.promotions,
`  // Regra SaborFlow 14.8:
  // qualquer agendamento usa preco normal.
  if (timing !== "now") {
    return prices
  }

  const now = new Date()
`,
`  // PROMO_SCHEDULE_SAME_DAY_1482
  // A promocao vale para "Para agora" e tambem para agendamento
  // do mesmo dia, desde que esteja ativa no momento do checkout.
  if (
    timing !== "now" &&
    timing !== "scheduled"
  ) {
    return prices
  }

  if (
    timing === "scheduled" &&
    !requestedFor
  ) {
    return prices
  }

  const now = new Date()
`,
  "Promotions DB: liberar agendamento promocional do mesmo dia"
)

next.promotions = replaceExact(
  next.promotions,
`  // Nao permite comprar hoje com preco
  // promocional para receber em outro dia.
`,
`  // Tanto no pedido imediato quanto no agendamento:
  // nunca permite usar o preco promocional para receber em outro dia.
`,
  "Promotions DB: atualizar comentario de seguranca"
)

// ============================================================
// 3) STOREFRONT: manter preco promocional no agendamento de HOJE
// ============================================================

next.storefront = replaceExact(
  next.storefront,
`  useEffect(() => {
    if (checkout.timing !== "scheduled") return
    if (cart.some((item) => Boolean(item.product.promotion))) {
      setPromotionNotice(
        "Promocoes valem somente para pedidos Para agora. No agendamento, os itens voltam automaticamente ao preco normal.",
      )
    }
    setCouponDiscount(0)
    setCouponMessage("")
  }, [checkout.timing])
`,
`  useEffect(() => {
    if (checkout.timing !== "scheduled") {
      setPromotionNotice("")
      return
    }

    if (
      cart.some(
        (item) =>
          Boolean(
            item.product.promotion,
          ),
      )
    ) {
      const today =
        new Date().toLocaleDateString(
          "en-CA",
          {
            timeZone:
              settings.timeZone ||
              "America/Sao_Paulo",
          },
        )

      setPromotionNotice(
        checkout.scheduleDate &&
        checkout.scheduleDate === today
          ? "Promoção mantida para o agendamento de hoje. Ela precisa continuar ativa no momento em que você finalizar o pedido."
          : "Para usar a promoção no agendamento, escolha um horário de hoje enquanto a promoção estiver ativa.",
      )
    } else {
      setPromotionNotice("")
    }

    setCouponDiscount(0)
    setCouponMessage("")
  }, [
    checkout.timing,
    checkout.scheduleDate,
    settings.timeZone,
  ])
`,
  "Storefront: atualizar aviso do agendamento promocional"
)

next.storefront = replaceExact(
  next.storefront,
`  function productPriceForTiming(product: Product, timing: Checkout["timing"]) {
    const promotion = product.promotion
    if (timing !== "now" || !promotion) return product.price

    const validUntil = new Date(promotion.validUntil).getTime()
    if (Number.isFinite(validUntil) && validUntil <= promotionClock) return product.price

    return Math.min(product.price, promotion.promotionalPrice)
  }
`,
`  function productPriceForTiming(product: Product, timing: Checkout["timing"]) {
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
`,
  "Storefront: preco promocional para agendamento de hoje"
)

next.storefront = replaceExact(
  next.storefront,
`    [cart, checkout.timing, promotionClock],
`,
`    [
      cart,
      checkout.timing,
      checkout.scheduleDate,
      promotionClock,
    ],
`,
  "Storefront: recalcular subtotal ao trocar data"
)

next.storefront = replaceExact(
  next.storefront,
`                    {checkout.timing === "now" && product.promotion ? (
`,
`                    {product.promotion && productPriceForTiming(product, checkout.timing) < product.price ? (
`,
  "Storefront: exibir promocao no card durante agendamento de hoje"
)

next.storefront = replaceExact(
  next.storefront,
`{money(productPriceForTiming(product, "now"))}`,
`{money(productPriceForTiming(product, checkout.timing))}`,
  "Storefront: usar timing atual no card"
)

next.storefront = replaceExact(
  next.storefront,
`onChange={(e) => {
  const timing = e.target.value as Checkout["timing"]
  const losesPromotion = timing === "scheduled" && cart.some((item) => Boolean(item.product.promotion))
  setCheckout({ ...checkout, timing, scheduleDate: "", scheduleTime: "" })
  setPromotionNotice(losesPromotion ? "Promocoes valem somente para pedidos Para agora. No agendamento, os itens voltam automaticamente ao preco normal." : "")
  setCouponDiscount(0)
  setCouponMessage("")
}}`,
`onChange={(e) => {
  const timing = e.target.value as Checkout["timing"]
  const hasPromotion = cart.some((item) => Boolean(item.product.promotion))
  setCheckout({ ...checkout, timing, scheduleDate: "", scheduleTime: "" })
  setPromotionNotice(
    timing === "scheduled" && hasPromotion
      ? "Para manter a promoção no agendamento, escolha um horário de hoje enquanto a promoção estiver ativa."
      : "",
  )
  setCouponDiscount(0)
  setCouponMessage("")
}}`,
  "Storefront: aviso ao selecionar agendamento"
)

// ============================================================
// 4) VALIDACAO EM MEMORIA
// ============================================================

const signals = [
  [next.dashboard, "MarketingPanel products={products}", "dashboard products"],
  [next.marketing, "toPromotionProducts", "marketing products"],
  [next.marketing, "Promoção imediata ou agendada para o mesmo dia", "marketing rule"],
  [next.promotions, "PROMO_SCHEDULE_SAME_DAY_1482", "backend same-day"],
  [next.storefront, "checkout.scheduleDate ===", "storefront same-day"],
  [next.storefront, "Promoção mantida para o agendamento de hoje", "storefront notice"],
]

for (const [content, signal, label] of signals) {
  if (!content.includes(signal)) {
    throw new Error(`Validacao final falhou: ${label}. Nenhum arquivo foi alterado.`)
  }
}

// ============================================================
// 5) BACKUPS E GRAVACAO
// ============================================================

for (const file of Object.values(files)) {
  fs.copyFileSync(file, `${file}.bak1482`)
}

fs.writeFileSync(files.dashboard, next.dashboard, "utf8")
fs.writeFileSync(files.marketing, next.marketing, "utf8")
fs.writeFileSync(files.promotions, next.promotions, "utf8")
fs.writeFileSync(files.storefront, next.storefront, "utf8")

console.log("")
console.log("==============================================")
console.log("HOTFIX 14.8.2 APLICADO")
console.log("==============================================")
console.log("- Produtos do dashboard agora alimentam o seletor de promocao")
console.log("- API continua sendo usada, com fallback seguro para os produtos ja carregados")
console.log("- Cliente pode agendar promocao para o mesmo dia")
console.log("- Promocao precisa estar ativa no momento do checkout")
console.log("- Agendamento para outro dia usa preco normal")
console.log("- Backend continua sendo a fonte autoritativa do preco")
console.log("")
console.log("Backups .bak1482 criados.")
console.log("Agora execute: npm run build")
