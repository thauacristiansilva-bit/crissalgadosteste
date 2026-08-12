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
  ShieldCheck,
  ShoppingCart,
  Star,
  Users,
  WalletCards,
  CreditCard,
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
import { DrePanel } from "@/components/admin/dre-panel"
import { BillingPanel } from "@/components/admin/billing-panel"
import { MarketingPanel } from "@/components/admin/marketing-panel"
import { ReviewsPanel } from "@/components/admin/reviews-panel"
import { LinksPanel } from "@/components/admin/links-panel"
import { ChatbotPanel } from "@/components/admin/chatbot-panel"
import { TeamPanel } from "@/components/admin/team-panel"
import { isStoreOpenNow, zonedDateString } from "@/lib/operations"
import { OrganizationSwitcher } from "@/components/admin/organization-switcher"
import { SecurityPanel } from "@/components/admin/security-panel"
import { getAllowedAdminSections, type AdminSection } from "@/lib/admin-access"
import type { OrganizationRole } from "@/lib/tenant-context"

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

type Section = AdminSection

const navItems: Array<{ key: Section; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Visão geral", icon: LayoutDashboard },
  { key: "pdv", label: "Pedidos PDV", icon: ShoppingCart },
  { key: "sales", label: "Vendas e caixa", icon: WalletCards },
  { key: "dre", label: "DRE gerencial", icon: DollarSign },
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
  { key: "security", label: "Conta e segurança", icon: ShieldCheck },
  { key: "billing", label: "Plano e assinatura", icon: CreditCard },
]

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const saborFlowBrand = {
  orange: "#f59e0b",
  orangeStrong: "#d96d00",
  brown: "#2f1c13",
  brownSoft: "#4b2c1d",
  cream: "#fff8ef",
  creamStrong: "#fff0dc",
  border: "#f0d0aa",
}

export function AdminDashboard({ initialData, adminEmail, adminRole, demoEnvironment }: { initialData: DashboardData; adminEmail: string; adminRole: OrganizationRole; demoEnvironment?: { kind: "public" | "trial"; expiresAt: string } | null }) {
  const router = useRouter()
  const [section, setSection] = useState<Section>(
    () =>
      (getAllowedAdminSections(adminRole)[0] as Section) ||
      "security",
  )
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
  const allowedSections = useMemo(
    () => new Set(getAllowedAdminSections(adminRole)),
    [adminRole],
  )
  const visibleNavItems = useMemo(
    () => navItems.filter((item) =>
      allowedSections.has(item.key) &&
      !(demoEnvironment && item.key === "billing"),
    ),
    [allowedSections, demoEnvironment],
  )

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
    const timeZone = settings.timeZone || "America/Sao_Paulo"
    const today = zonedDateString(new Date(), timeZone)
    const todayOrders = valid.filter(
      (order) => zonedDateString(new Date(order.createdAt), timeZone) === today,
    )
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
  }, [orders, settings.timeZone])

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

  const title = visibleNavItems.find((item) => item.key === section)?.label || "Admin"
  const operatingNow = isStoreOpenNow(settings)
  const openCash = cashSessions.find((session) => !session.closedAt)

  const nav = (
    <>
      <div className="border-b px-3 py-3" style={{ borderColor: "rgba(255,255,255,.10)" }}>
        <div className="flex items-center justify-center gap-3 rounded-2xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,.10)", background: "linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.02))" }}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-md">
            <img src="/saborflow-brand.png" alt="SaborFlow" className="h-full w-full object-contain" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: "#ffd39f" }}>Plataforma</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#ffd39f" }}>Operação</p>
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const active = section === item.key
          return (
            <button
              key={item.key}
              onClick={() => changeSection(item.key)}
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition"
              style={active ? { backgroundColor: saborFlowBrand.cream, color: saborFlowBrand.brown, boxShadow: "0 8px 20px rgba(0,0,0,.13)" } : { color: "#fff7ee" }}
            >
              <Icon className="h-4 w-4" style={active ? { color: saborFlowBrand.orangeStrong } : { color: "#ffd39f" }} />
              <span className="truncate">{item.label}</span>
              {item.key === "orders" && <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={active ? { backgroundColor: saborFlowBrand.orangeStrong, color: "#fff" } : { backgroundColor: "rgba(255,255,255,.10)", color: "#fff" }}>{summary.openOrders + summary.readyOrders}</span>}
              {item.key === "inventory" && products.some((product) => product.trackStock && product.stock <= product.minStock) && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-300" />}
            </button>
          )
        })}
      </nav>

      <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,.10)" }}>
        <div className="mb-2 flex items-center gap-2.5 rounded-xl p-2" style={{ backgroundColor: "rgba(255,255,255,.06)" }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: `linear-gradient(135deg, ${saborFlowBrand.orangeStrong}, ${saborFlowBrand.orange})` }}>SF</div>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-white">Administrador</p><p className="truncate text-[10px]" style={{ color: "#e8c6a0" }}>{adminEmail}</p></div>
        </div>
        <button onClick={logout} disabled={loggingOut} type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold text-white transition hover:bg-white/10 disabled:opacity-50" style={{ borderColor: "rgba(255,255,255,.12)" }}><LogOut className="h-3.5 w-3.5" />{loggingOut ? "Saindo..." : "Sair"}</button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen text-gray-950 lg:flex" style={{ backgroundColor: saborFlowBrand.cream }}>
      <aside className="hidden h-screen w-80 shrink-0 flex-col lg:sticky lg:top-0 lg:flex" style={{ background: `linear-gradient(180deg, ${saborFlowBrand.brown} 0%, ${saborFlowBrand.brownSoft} 100%)` }}>{nav}</aside>
      {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" /><aside className="relative flex h-full w-80 flex-col shadow-2xl" style={{ background: `linear-gradient(180deg, ${saborFlowBrand.brown} 0%, ${saborFlowBrand.brownSoft} 100%)` }}><button onClick={() => setMobileNav(false)} aria-label="Fechar menu" className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>{nav}</aside></div>}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between border-b bg-white/95 px-4 py-3 backdrop-blur sm:px-6" style={{ borderColor: saborFlowBrand.border }}>
          <div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} type="button" className="rounded-2xl border p-2 text-gray-600 lg:hidden" style={{ borderColor: saborFlowBrand.border }} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><div><h1 className="font-black text-gray-950">{title}</h1><p className="hidden text-xs text-gray-500 sm:block">{settings.storeName} · {settings.city} - {settings.state}</p></div></div>
          <div className="flex items-center gap-2"><OrganizationSwitcher fallbackName={settings.storeName} variant="compact" /><span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${operatingNow ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>● {operatingNow ? "Loja aberta" : settings.acceptingOrders ? "Fora do expediente" : "Pedidos pausados"}</span><button onClick={() => changeSection("orders")} type="button" className="relative rounded-2xl border p-2.5 text-gray-600 hover:bg-gray-50" style={{ borderColor: saborFlowBrand.border }} aria-label="Notificações"><Bell className="h-4 w-4" />{summary.openOrders > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{summary.openOrders}</span>}</button></div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
          {demoEnvironment && (
            <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">Ambiente demonstrativo</p>
                <p className="mt-1 text-sm font-black text-amber-950">{demoEnvironment.kind === "public" ? "Demo pública isolada" : "Trial individual isolado"}</p>
                <p className="mt-1 text-xs text-amber-800">Dados fictícios · integrações externas bloqueadas · expira em {new Date(demoEnvironment.expiresAt).toLocaleString("pt-BR")}</p>
              </div>
              <a href="/demo" className="rounded-2xl border border-amber-300 bg-white px-4 py-2 text-xs font-black text-amber-900">Sobre a demo</a>
            </div>
          )}
          <div className="mb-5 flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: saborFlowBrand.border }}>
            <div><p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: saborFlowBrand.orangeStrong }}>SaborFlow</p><p className="text-sm font-bold" style={{ color: saborFlowBrand.brown }}>Empresa ativa · {settings.storeName}</p></div>
            <span className="rounded-2xl px-3 py-2 text-xs font-black" style={{ color: saborFlowBrand.brown, backgroundColor: saborFlowBrand.creamStrong }}>Painel oficial</span>
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
                <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${saborFlowBrand.brown} 0%, ${saborFlowBrand.orangeStrong} 100%)` }}><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#ffd39f" }}>Loja online</p><h2 className="mt-2 text-lg font-black">Site conectado ao admin</h2><p className="mt-2 text-sm leading-relaxed text-blue-100">Cardápio, disponibilidade, estoque, branding, taxas e pedidos usam a mesma base.</p><a href="/minha-loja" target="_blank" className="mt-4 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-900">Abrir loja</a></div>
              </aside>
            </div>
          </div>}
          {section === "pdv" && <PdvPanel products={products} settings={settings} onOrderCreated={onOrderCreated} />}
          {section === "sales" && <SalesPanel orders={orders} settings={settings} initialCashSessions={cashSessions} initialEntries={financialEntries} />}
          {section === "dre" && <DrePanel timeZone={settings.timeZone || "America/Sao_Paulo"} />}
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
          {section === "security" && <SecurityPanel role={adminRole} />}
          {section === "billing" && <BillingPanel />}

          <footer className="mt-8 rounded-3xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: saborFlowBrand.border }}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-black" style={{ color: saborFlowBrand.brown }}>Plataforma</p><p className="text-xs text-gray-500">Painel administrativo do SaborFlow.</p></div>
              <p className="text-xs font-semibold text-gray-500">Empresa ativa: <span style={{ color: saborFlowBrand.orangeStrong }}>{settings.storeName}</span></p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
