"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  BookOpen,
  ChefHat,
  ClipboardList,
  DollarSign,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Settings,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import type { Category, Courier, CustomerSummary, DashboardSummary, DeliveryZone, Order, Product, StoreSettings } from "@/lib/types"
import { OrdersPanel } from "@/components/admin/orders-panel"
import { ProductsPanel } from "@/components/admin/products-panel"
import { CategoriesPanel } from "@/components/admin/categories-panel"
import { KitchenPanel } from "@/components/admin/kitchen-panel"
import { CustomersPanel } from "@/components/admin/customers-panel"
import { SettingsPanel } from "@/components/admin/settings-panel"
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
}

type Section = "overview" | "orders" | "kitchen" | "products" | "categories" | "customers" | "settings"

const navItems: Array<{ key: Section; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Visão geral", icon: LayoutDashboard },
  { key: "orders", label: "Pedidos", icon: ClipboardList },
  { key: "kitchen", label: "Cozinha", icon: ChefHat },
  { key: "products", label: "Produtos", icon: BookOpen },
  { key: "categories", label: "Categorias", icon: FolderTree },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "settings", label: "Configurações", icon: Settings },
]

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export function AdminDashboard({ initialData, adminEmail }: { initialData: DashboardData; adminEmail: string }) {
  const router = useRouter()
  const [section, setSection] = useState<Section>("overview")
  const [mobileNav, setMobileNav] = useState(false)
  const [orders, setOrders] = useState(initialData.orders)
  const [products, setProducts] = useState(initialData.products)
  const [categories, setCategories] = useState(initialData.categories)
  const [settings, setSettings] = useState(initialData.settings)
  const [customers] = useState(initialData.customers)
  const [deliveryZones, setDeliveryZones] = useState(initialData.deliveryZones)
  const [couriers, setCouriers] = useState(initialData.couriers)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const refreshOrders = async () => {
      const response = await fetch("/api/orders", { cache: "no-store" }).catch(() => null)
      if (!response?.ok) return
      const data = await response.json()
      if (Array.isArray(data.orders)) setOrders(data.orders)
    }
    const id = window.setInterval(refreshOrders, 5000)
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

  async function logout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  const title = navItems.find((item) => item.key === section)?.label || "Admin"
  const operatingNow = isStoreOpenNow(settings)

  const nav = (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl ring-1 ring-white/15">🥟</div>
          <div><p className="font-black text-white">{settings.storeName}</p><p className="text-xs text-blue-200">Administração</p></div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Sistema</p>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = section === item.key
          return (
            <button key={item.key} onClick={() => changeSection(item.key)} type="button" className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-white text-blue-800 shadow-sm" : "text-blue-50 hover:bg-white/10"}`}>
              <Icon className={`h-[18px] w-[18px] ${active ? "text-blue-700" : "text-blue-200"}`} />
              {item.label}
              {item.key === "orders" && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-blue-50 text-blue-700" : "bg-white/10 text-white"}`}>{summary.openOrders + summary.readyOrders}</span>}
            </button>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <a href="/" target="_blank" className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"><Store className="h-4 w-4" />Abrir site do cliente</a>
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">CS</div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">Administrador</p><p className="truncate text-[11px] text-blue-200">{adminEmail}</p></div></div>
        <button onClick={logout} disabled={loggingOut} type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-blue-50 transition hover:bg-white/10 disabled:opacity-50"><LogOut className="h-4 w-4" />{loggingOut ? "Saindo..." : "Sair"}</button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-gray-950 lg:flex">
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-blue-900 lg:sticky lg:top-0 lg:flex">{nav}</aside>
      {mobileNav && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" onClick={() => setMobileNav(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" /><aside className="relative flex h-full w-72 flex-col bg-blue-900 shadow-2xl"><button onClick={() => setMobileNav(false)} aria-label="Fechar menu" className="absolute right-3 top-3 rounded-lg p-2 text-blue-100 hover:bg-white/10"><X className="h-5 w-5" /></button>{nav}</aside></div>}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} type="button" className="rounded-xl border border-gray-200 p-2 text-gray-600 lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><div><h1 className="font-black text-gray-950">{title}</h1><p className="hidden text-xs text-gray-500 sm:block">{settings.storeName} · {settings.city} - {settings.state}</p></div></div>
          <div className="flex items-center gap-2"><span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${operatingNow ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>● {operatingNow ? "Loja aberta" : settings.acceptingOrders ? "Fora do expediente" : "Pedidos pausados"}</span><button onClick={() => changeSection("orders")} type="button" className="relative rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-gray-50" aria-label="Notificações"><Bell className="h-4 w-4" />{summary.openOrders > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{summary.openOrders}</span>}</button></div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
          {section === "overview" && <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Pedidos hoje", value: summary.todayOrders, icon: ReceiptText, description: `${summary.openOrders} em andamento`, cls: "text-blue-700 bg-blue-50" },
                { label: "Faturamento hoje", value: formatCurrency(summary.todayRevenue), icon: DollarSign, description: "Pedidos não cancelados", cls: "text-violet-700 bg-violet-50" },
                { label: "Prontos", value: summary.readyOrders, icon: PackageCheck, description: "Aguardando retirada/entrega", cls: "text-emerald-700 bg-emerald-50" },
                { label: "Não pagos", value: summary.unpaid, icon: ClipboardList, description: `${summary.totalOrders} pedidos no histórico`, cls: "text-amber-700 bg-amber-50" },
              ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-gray-500">{card.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{card.value}</p></div><div className={`rounded-xl p-2.5 ${card.cls}`}><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-xs text-gray-400">{card.description}</p></article> })}
            </section>
            <div className="grid gap-5 xl:grid-cols-[1.5fr_.5fr]"><OrdersPanel orders={orders.slice(0, 5)} couriers={couriers} onOrderUpdated={onOrderUpdated} /><aside className="space-y-4"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-gray-900">Atalhos</h2><div className="mt-4 grid gap-2"><button onClick={() => changeSection("orders")} className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-left text-sm font-bold text-blue-800 hover:bg-blue-100"><ClipboardList className="h-5 w-5" />Gerenciar pedidos</button><button onClick={() => changeSection("kitchen")} className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-left text-sm font-bold text-amber-800 hover:bg-amber-100"><ChefHat className="h-5 w-5" />Abrir cozinha</button><button onClick={() => changeSection("products")} className="flex items-center gap-3 rounded-xl bg-violet-50 px-4 py-3 text-left text-sm font-bold text-violet-800 hover:bg-violet-100"><BookOpen className="h-5 w-5" />Editar cardápio</button></div></div><div className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-950 p-5 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Loja online</p><h2 className="mt-2 text-lg font-black">Site conectado ao admin</h2><p className="mt-2 text-sm leading-relaxed text-blue-100">Produtos, disponibilidade, taxa de entrega e novos pedidos usam a mesma base.</p><a href="/" target="_blank" className="mt-4 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-900">Abrir cardápio</a></div></aside></div>
          </div>}
          {section === "orders" && <OrdersPanel orders={orders} couriers={couriers} onOrderUpdated={onOrderUpdated} />}
          {section === "kitchen" && <KitchenPanel orders={orders} settings={settings} onOrderUpdated={onOrderUpdated} />}
          {section === "products" && <ProductsPanel products={products} categories={categories} onProductsChanged={setProducts} />}
          {section === "categories" && <CategoriesPanel categories={categories} onCategoriesChanged={setCategories} />}
          {section === "customers" && <CustomersPanel customers={customers} />}
          {section === "settings" && <SettingsPanel settings={settings} deliveryZones={deliveryZones} couriers={couriers} onSettingsChanged={setSettings} onDeliveryZonesChanged={setDeliveryZones} onCouriersChanged={setCouriers} />}
        </main>
      </div>
    </div>
  )
}
