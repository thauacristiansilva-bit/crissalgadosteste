"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  BookOpen,
  Bot,
  ChefHat,
  ClipboardList,
  DollarSign,
  FolderTree,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react"
import type {
  CashSession,
  Category,
  Coupon,
  Courier,
  CustomerSummary,
  DashboardSummary,
  DeliveryZone,
  Feedback,
  FinancialEntry,
  Order,
  Product,
  StoreSettings,
  StaffMember,
} from "@/lib/types"
import { OrdersPanel } from "@/components/admin/orders-panel"
import { ProductsPanel } from "@/components/admin/products-panel"
import { CategoriesPanel } from "@/components/admin/categories-panel"
import { KitchenPanel } from "@/components/admin/kitchen-panel"
import { CustomersPanel } from "@/components/admin/customers-panel"
import { SettingsPanel } from "@/components/admin/settings-panel"
import { PdvPanel } from "@/components/admin/pdv-panel"
import { InventoryPanel } from "@/components/admin/inventory-panel"
import { SalesPanel } from "@/components/admin/sales-panel"
import { MarketingPanel } from "@/components/admin/marketing-panel"
import { ReviewsPanel } from "@/components/admin/reviews-panel"
import { LinksPanel } from "@/components/admin/links-panel"
import { ChatbotPanel } from "@/components/admin/chatbot-panel"
import { TeamPanel } from "@/components/admin/team-panel"
import { isStoreOpenNow } from "@/lib/operations"

interface DashboardData {
  summary: DashboardSummary
  orders: Order[]
  products: Product[]
  categories: Category[]
  settings: StoreSettings
  customers: CustomerSummary[]
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  feedbacks: Feedback[]
  coupons: Coupon[]
  cashSessions: CashSession[]
  financialEntries: FinancialEntry[]
  staffMembers: StaffMember[]
}

type Section =
  | "overview"
  | "pdv"
  | "sales"
  | "orders"
  | "kitchen"
  | "inventory"
  | "products"
  | "categories"
  | "customers"
  | "marketing"
  | "reviews"
  | "links"
  | "chatbot"
  | "team"
  | "settings"

const navItems: Array<{ key: Section; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Visão geral", icon: LayoutDashboard },
  { key: "pdv", label: "Pedidos PDV", icon: ShoppingCart },
  { key: "sales", label: "Vendas e caixa", icon: WalletCards },
  { key: "orders", label: "Pedidos", icon: ClipboardList },
  { key: "kitchen", label: "Cozinha", icon: ChefHat },
  { key: "inventory", label: "Inventário", icon: PackageSearch },
  { key: "products", label: "Cardápio", icon: BookOpen },
  { key: "categories", label: "Categorias", icon: FolderTree },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "reviews", label: "Avaliações", icon: Star },
  { key: "links", label: "QR e links", icon: Link2 },
  { key: "chatbot", label: "Chatbot", icon: Bot },
  { key: "team", label: "Equipe e funções", icon: Users },
  { key: "settings", label: "Configurações", icon: Settings },
]

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const brand = {
  orange: "#f59e0b",
  orangeStrong: "#e17b00",
  brown: "#3c2415",
  brownSoft: "#5a3822",
  cream: "#fff8ef",
  creamStrong: "#fff2df",
  border: "#f3d3a7",
}

export function AdminDashboard({ initialData, adminEmail }: { initialData: DashboardData; adminEmail: string }) {
  const router = useRouter()
  const [section, setSection] = useState<Section>("overview")
  const [mobileNav, setMobileNav] = useState(false)
  const [orders, setOrders] = useState(initialData.orders)
  const [products, setProducts] = useState(initialData.products)
  const [categories, setCategories] = useState(initialData.categories)
  const [settings, setSettings] = useState(initialData.settings)
  const [customers, setCustomers] = useState(initialData.customers)
  const [deliveryZones, setDeliveryZones] = useState(initialData.deliveryZones)
  const [couriers, setCouriers] = useState(initialData.couriers)
  const [feedbacks, setFeedbacks] = useState(initialData.feedbacks)
  const [coupons] = useState(initialData.coupons)
  const [cashSessions, setCashSessions] = useState(initialData.cashSessions)
  const [financialEntries, setFinancialEntries] = useState(initialData.financialEntries)
  const [staffMembers] = useState(initialData.staffMembers)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/dashboard", { cache: "no-store" }).catch(() => null)
      if (!response?.ok) return
      const data = (await response.json()) as Partial<DashboardData>
      if (Array.isArray(data.orders)) setOrders(data.orders)
      if (Array.isArray(data.products)) setProducts(data.products)
      if (Array.isArray(data.customers)) setCustomers(data.customers)
      if (Array.isArray(data.feedbacks)) setFeedbacks(data.feedbacks)
      if (Array.isArray(data.cashSessions)) setCashSessions(data.cashSessions)
      if (Array.isArray(data.financialEntries)) setFinancialEntries(data.financialEntries)
    }
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [])

  const summary = useMemo<DashboardSummary>(() => {
    const valid = orders.filter((order) => order.status !== "cancelled")
    const today = new Date().toLocaleDateString("en-CA")
    const todayOrders = valid.filter((order) => new Date(order.createdAt).toLocaleDateString("en-CA") === today)
    return {
      totalOrders: orders.length,
      openOrders: orders.filter((order) => ["pending", "accepted", "preparing", "in-route"].includes(order.status)).length,
      readyOrders: orders.filter((order) => order.status === "ready").length,
      completedOrders: orders.filter((order) => order.status === "completed").length,
      revenue: Number(valid.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
      unpaid: valid.filter((order) => order.paymentStatus === "unpaid").length,
      todayOrders: todayOrders.length,
      todayRevenue: Number(todayOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)),
    }
  }, [orders])

  function changeSection(next: Section) {
    setSection(next)
    setMobileNav(false)
  }

  function onOrderUpdated(updated: Order) {
    setOrders((current) => current.map((order) => order.id === updated.id ? updated : order))
  }

  function onOrderCreated(created: Order) {
    setOrders((current) => [created, ...current.filter((order) => order.id !== created.id)])
    setSection("orders")
  }

  async function logout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  const title = navItems.find((item) => item.key === section)?.label || "Admin"
  const operatingNow = isStoreOpenNow(settings)
  const openCash = cashSessions.find((session) => !session.closedAt)

  const nav = (
    <>
      <div className="border-b px-4 py-5" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        <div className="rounded-3xl border p-4 shadow-lg" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))", borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <img src="/saborflow-brand.png" alt="SaborFlow" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "#ffd9ac" }}>Marca registrada</p>
              <p className="truncate text-2xl font-black text-white">SaborFlow®</p>
              <p className="truncate text-sm" style={{ color: "#f8ddbd" }}>{settings.storeName}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white">
                {settings.logoImage ? <img src={settings.logoImage} alt="Logo da loja" className="h-full w-full object-cover" /> : <Store className="h-5 w-5" style={{ color: brand.orangeStrong }} />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{settings.storeName}</p>
                <p className="truncate text-[11px]" style={{ color: "#e9c8a0" }}>Painel administrativo da empresa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "#ffddb5" }}>Operação</p>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = section === item.key
          return (
            <button
              key={item.key}
              onClick={() => changeSection(item.key)}
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition"
              style={active ? { backgroundColor: brand.cream, color: brand.brown, boxShadow: "0 6px 18px rgba(0,0,0,0.12)" } : { color: "#fff7ee" }}
            >
              <Icon className="h-[18px] w-[18px]" style={active ? { color: brand.orangeStrong } : { color: "#ffd6a6" }} />
              <span className="truncate">{item.label}</span>
              {item.key === "orders" && <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={active ? { backgroundColor: brand.orange, color: "white" } : { backgroundColor: "rgba(255,255,255,0.10)", color: "white" }}>{summary.openOrders + summary.readyOrders}</span>}
              {item.key === "inventory" && products.some((p) => p.trackStock && p.stock <= p.minStock) && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-300" />}
            </button>
          )
        })}
      </nav>
      <div className="border-t p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        <a href="/" target="_blank" className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black text-white shadow-sm transition hover:opacity-95" style={{ background: `linear-gradient(135deg, ${brand.orangeStrong}, ${brand.orange})` }}><Store className="h-4 w-4" />Abrir site do cliente</a>
        <div className="mb-3 flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: `linear-gradient(135deg, ${brand.orangeStrong}, ${brand.orange})` }}>SF</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white">Administrador</p>
            <p className="truncate text-[11px]" style={{ color: "#f0d1a9" }}>{adminEmail}</p>
          </div>
        </div>
        <button onClick={logout} disabled={loggingOut} type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50" style={{ borderColor: "rgba(255,255,255,0.12)" }}><LogOut className="h-4 w-4" />{loggingOut ? "Saindo..." : "Sair"}</button>
        <div className="mt-4 rounded-2xl border px-3 py-3 text-center" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}>
          <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: "#ffd9ac" }}>Rodapé do sistema</p>
          <p className="mt-1 text-xs text-white">SaborFlow® · Plataforma oficial</p>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen text-gray-950 lg:flex" style={{ backgroundColor: brand.cream }}>
      <aside className="hidden h-screen w-80 shrink-0 flex-col lg:sticky lg:top-0 lg:flex" style={{ background: `linear-gradient(180deg, ${brand.brown} 0%, ${brand.brownSoft} 100%)` }}>{nav}</aside>
      {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" /><aside className="relative flex h-full w-80 flex-col shadow-2xl" style={{ background: `linear-gradient(180deg, ${brand.brown} 0%, ${brand.brownSoft} 100%)` }}><button onClick={() => setMobileNav(false)} aria-label="Fechar menu" className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>{nav}</aside></div>}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-6" style={{ borderColor: brand.border }}>
          <div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} type="button" className="rounded-2xl border p-2 text-gray-600 lg:hidden" style={{ borderColor: brand.border }} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><div className="flex items-center gap-3"><div className="hidden rounded-2xl border bg-white px-3 py-2 shadow-sm md:flex" style={{ borderColor: brand.border }}><img src="/saborflow-brand.png" alt="SaborFlow" className="h-10 w-10 rounded-xl object-contain" /><div className="ml-3"><p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: brand.orangeStrong }}>Marca registrada</p><p className="text-sm font-black" style={{ color: brand.brown }}>SaborFlow®</p></div></div><div><h1 className="font-black text-gray-950">{title}</h1><p className="hidden text-xs text-gray-500 sm:block">{settings.storeName} · {settings.city} - {settings.state}</p></div></div></div>
          <div className="flex items-center gap-2"><span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${operatingNow ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>● {operatingNow ? "Loja aberta" : settings.acceptingOrders ? "Fora do expediente" : "Pedidos pausados"}</span><button onClick={() => changeSection("orders")} type="button" className="relative rounded-2xl border p-2.5 text-gray-600 hover:bg-gray-50" style={{ borderColor: brand.border }} aria-label="Notificações"><Bell className="h-4 w-4" />{summary.openOrders > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{summary.openOrders}</span>}</button></div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl border bg-white px-4 py-4 shadow-sm" style={{ borderColor: brand.border }}>
            <div className="flex items-center gap-3">
              <img src="/saborflow-brand.png" alt="SaborFlow" className="h-12 w-12 rounded-2xl object-contain" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: brand.orangeStrong }}>SaborFlow®</p>
                <p className="text-sm font-semibold text-gray-700">Painel oficial com identidade fixa da plataforma</p>
              </div>
            </div>
            <div className="hidden rounded-2xl px-3 py-2 text-xs font-bold md:block" style={{ backgroundColor: brand.creamStrong, color: brand.brown }}>Marca registrada ativa</div>
          </div>
          {settings.cashRegisterEnabled && !openCash && (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-black">⚠️ Seu caixa está fechado</p><p className="text-sm text-amber-800">Abra o caixa para manter o controle do turno, vendas e conferência financeira.</p></div>
              <button type="button" onClick={() => changeSection("sales")} className="h-10 rounded-xl bg-white px-4 text-sm font-black text-amber-900 shadow-sm ring-1 ring-amber-200">Abrir caixa</button>
            </div>
          )}
          {section === "overview" && <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Pedidos hoje", value: summary.todayOrders, icon: ReceiptText, description: `${summary.openOrders} em andamento`, cls: "text-blue-700 bg-blue-50" },
                { label: "Faturamento hoje", value: formatCurrency(summary.todayRevenue), icon: DollarSign, description: "Pedidos não cancelados", cls: "text-violet-700 bg-violet-50" },
                { label: "Prontos", value: summary.readyOrders, icon: PackageCheck, description: "Aguardando retirada/entrega", cls: "text-emerald-700 bg-emerald-50" },
                { label: "Não pagos", value: summary.unpaid, icon: ClipboardList, description: `${summary.totalOrders} pedidos no histórico`, cls: "text-amber-700 bg-amber-50" },
              ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-gray-500">{card.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{card.value}</p></div><div className={`rounded-xl p-2.5 ${card.cls}`}><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-xs text-gray-400">{card.description}</p></article> })}
            </section>
            <div className="grid gap-5 xl:grid-cols-[1.5fr_.5fr]">
              <OrdersPanel orders={orders.slice(0, 5)} couriers={couriers} settings={settings} onOrderUpdated={onOrderUpdated} />
              <aside className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-gray-900">Atalhos</h2><div className="mt-4 grid gap-2"><button onClick={() => changeSection("pdv")} className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-blue-800 hover:bg-blue-100"><ShoppingCart className="h-5 w-5" />Novo pedido no balcão</button><button onClick={() => changeSection("kitchen")} className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-left text-sm font-bold text-amber-800 hover:bg-amber-100"><ChefHat className="h-5 w-5" />Abrir cozinha</button><button onClick={() => changeSection("inventory")} className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-left text-sm font-bold text-emerald-800 hover:bg-emerald-100"><PackageSearch className="h-5 w-5" />Ver inventário</button><button onClick={() => changeSection("products")} className="flex items-center gap-3 rounded-xl bg-violet-50 px-4 py-3 text-left text-sm font-bold text-violet-800 hover:bg-violet-100"><BookOpen className="h-5 w-5" />Editar cardápio</button></div></div>
                <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${brand.brown} 0%, ${brand.orangeStrong} 100%)` }}><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#ffddb5" }}>Loja online</p><h2 className="mt-2 text-lg font-black">Site conectado ao admin</h2><p className="mt-2 text-sm leading-relaxed text-blue-100">Cardápio, disponibilidade, estoque, branding, taxas e pedidos usam a mesma base da plataforma SaborFlow.</p><a href="/" target="_blank" className="mt-4 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-900">Abrir cardápio</a></div>
              </aside>
            </div>
          </div>}
          {section === "pdv" && <PdvPanel products={products} settings={settings} onOrderCreated={onOrderCreated} />}
          {section === "sales" && <SalesPanel orders={orders} settings={settings} initialCashSessions={cashSessions} initialEntries={financialEntries} />}
          {section === "orders" && <OrdersPanel orders={orders} couriers={couriers} settings={settings} onOrderUpdated={onOrderUpdated} />}
          {section === "kitchen" && <KitchenPanel orders={orders} settings={settings} onOrderUpdated={onOrderUpdated} />}
          {section === "inventory" && <InventoryPanel products={products} onProductsChanged={setProducts} />}
          {section === "products" && <ProductsPanel products={products} categories={categories} onProductsChanged={setProducts} />}
          {section === "categories" && <CategoriesPanel categories={categories} onCategoriesChanged={setCategories} />}
          {section === "customers" && <CustomersPanel customers={customers} onCustomersChanged={setCustomers} />}
          {section === "marketing" && <MarketingPanel coupons={coupons} customers={customers} settings={settings} onSettingsChanged={setSettings} />}
          {section === "reviews" && <ReviewsPanel feedbacks={feedbacks} settings={settings} />}
          {section === "links" && <LinksPanel settings={settings} />}
          {section === "chatbot" && <ChatbotPanel settings={settings} onSettingsChanged={setSettings} />}
          {section === "team" && <TeamPanel staffMembers={staffMembers} />}
          {section === "settings" && <SettingsPanel settings={settings} deliveryZones={deliveryZones} couriers={couriers} onSettingsChanged={setSettings} onDeliveryZonesChanged={setDeliveryZones} onCouriersChanged={setCouriers} />}

          <footer className="mt-8 rounded-3xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: brand.border }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <img src="/saborflow-brand.png" alt="SaborFlow" className="h-10 w-10 rounded-xl object-contain" />
                <div>
                  <p className="text-sm font-black" style={{ color: brand.brown }}>SaborFlow®</p>
                  <p className="text-xs text-gray-500">Marca registrada fixa do sistema · Login, sidebar e rodapé personalizados</p>
                </div>
              </div>
              <div className="text-xs font-semibold text-gray-500">Sistema licenciado para <span style={{ color: brand.orangeStrong }}>{settings.storeName}</span></div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
