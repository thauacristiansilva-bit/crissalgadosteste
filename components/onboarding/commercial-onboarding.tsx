"use client"

import { type ReactNode, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Check,
  ChevronRight,
  Clock3,
  ImageIcon,
  LoaderCircle,
  MapPin,
  PackagePlus,
  Rocket,
  ShoppingBag,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react"
import type {
  CommercialOnboardingSnapshot,
  CommercialOnboardingStep,
} from "@/lib/commercial-onboarding"
import type { BusinessHour } from "@/lib/types"

const steps: Array<{
  key: CommercialOnboardingStep
  label: string
  short: string
  icon: LucideIcon
}> = [
  { key: "business", label: "Dados comerciais", short: "Dados", icon: Building2 },
  { key: "brand", label: "Identidade visual", short: "Marca", icon: ImageIcon },
  { key: "hours", label: "Horários", short: "Horários", icon: Clock3 },
  { key: "fulfillment", label: "Entrega e retirada", short: "Operação", icon: Truck },
  { key: "catalog", label: "Produtos", short: "Produtos", icon: ShoppingBag },
  { key: "publish", label: "Publicar", short: "Publicar", icon: Rocket },
]

const field = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
const labelClass = "mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500"

export function CommercialOnboarding({
  initialOnboarding,
}: {
  initialOnboarding: CommercialOnboardingSnapshot
}) {
  const router = useRouter()
  const [onboarding, setOnboarding] = useState(initialOnboarding)
  const initialStep = initialOnboarding.state.currentStep === "published"
    ? "publish"
    : initialOnboarding.state.currentStep
  const [step, setStep] = useState<CommercialOnboardingStep>(initialStep)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const settings = initialOnboarding.settings
  const [business, setBusiness] = useState({
    storeName: settings.storeName,
    legalName: initialOnboarding.organization.legalName,
    industry: initialOnboarding.organization.industry,
    phone: initialOnboarding.organization.phone || settings.phone,
    email: initialOnboarding.organization.email,
    address: settings.address,
    storeDistrict: settings.storeDistrict,
    city: settings.city,
    state: settings.state,
    zipCode: settings.zipCode,
  })
  const [brand, setBrand] = useState({
    slogan: settings.slogan,
    welcomeTitle: settings.welcomeTitle,
    welcomeText: settings.welcomeText,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    backgroundColor: settings.backgroundColor,
    logoImage: settings.logoImage,
    coverImage: settings.coverImage,
  })
  const [hours, setHours] = useState<BusinessHour[]>(
    settings.businessHours.map((item) => ({ ...item })),
  )
  const [fulfillment, setFulfillment] = useState({
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    minimumOrder: settings.minimumOrder,
    pickupLeadMinutes: settings.pickupLeadMinutes,
    deliveryMinMinutes: settings.deliveryMinMinutes,
    deliveryMaxMinutes: settings.deliveryMaxMinutes,
  })
  const [product, setProduct] = useState({ name: "", category: "", price: "" })

  const completed = useMemo(
    () => new Set(onboarding.state.completedSteps),
    [onboarding.state.completedSteps],
  )

  async function refresh() {
    const response = await fetch("/api/admin/commercial-onboarding", { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o onboarding.")
    setOnboarding(payload.onboarding)
    return payload.onboarding as CommercialOnboardingSnapshot
  }

  async function save(current: CommercialOnboardingStep) {
    if (current === "publish") return publish()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const data = current === "business"
        ? business
        : current === "brand"
          ? brand
          : current === "hours"
            ? { businessHours: hours }
            : current === "fulfillment"
              ? fulfillment
              : {}

      const response = await fetch("/api/admin/commercial-onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: current, data }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar esta etapa.")
      const next = payload.onboarding as CommercialOnboardingSnapshot
      setOnboarding(next)
      setNotice("Etapa salva.")
      if (next.state.currentStep !== "published") {
        setStep(next.state.currentStep)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar esta etapa.")
    } finally {
      setBusy(false)
    }
  }

  async function createProduct() {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const price = Number(String(product.price).replace(",", "."))
      if (!product.name.trim() || !product.category.trim() || !Number.isFinite(price) || price <= 0) {
        throw new Error("Informe nome, categoria e preço válido para o produto.")
      }
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          category: product.category,
          price,
          description: "",
          image: "",
          featured: false,
          trackStock: false,
          stock: 0,
          minStock: 0,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível cadastrar o produto.")
      setProduct({ name: "", category: "", price: "" })
      await refresh()
      setNotice("Produto cadastrado. Você já pode continuar.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível cadastrar o produto.")
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/commercial-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível publicar a loja.")
      router.replace("/admin")
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar a loja.")
      await refresh().catch(() => null)
    } finally {
      setBusy(false)
    }
  }

  function updateHour(index: number, patch: Partial<BusinessHour>) {
    setHours((current) => current.map((item, currentIndex) =>
      currentIndex === index ? { ...item, ...patch } : item,
    ))
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-6 text-gray-950 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">SaborFlow · configuração comercial</p>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">Prepare sua loja para vender</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                  A loja permanece privada enquanto você configura os dados essenciais. A publicação só acontece depois da validação final do servidor.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-black text-gray-900">{onboarding.billing.planName || "Plano atual"}</p>
              <p className="mt-1 text-xs text-gray-500">
                Lojas {onboarding.billing.organizationsUsed} / {onboarding.billing.organizationsLimit === null ? "∞" : onboarding.billing.organizationsLimit}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-amber-200 bg-white p-3 shadow-sm lg:sticky lg:top-5">
            {steps.map((item, index) => {
              const Icon = item.icon
              const done = completed.has(item.key)
              const active = step === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStep(item.key)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-amber-100 text-amber-950" : "hover:bg-gray-50"}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-white text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Etapa {index + 1}</span>
                    <span className="block truncate text-sm font-black">{item.short}</span>
                  </span>
                </button>
              )
            })}
          </aside>

          <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-7">
            {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
            {notice && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</div>}

            {step === "business" && (
              <Step title="Dados comerciais" description="Complete as informações que identificam a loja e serão usadas no atendimento ao cliente." icon={Building2}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome comercial" className="sm:col-span-2"><input className={field} value={business.storeName} onChange={(e) => setBusiness({ ...business, storeName: e.target.value })} /></Field>
                  <Field label="Razão social"><input className={field} value={business.legalName} onChange={(e) => setBusiness({ ...business, legalName: e.target.value })} /></Field>
                  <Field label="Segmento"><input className={field} placeholder="Ex.: Pizzaria" value={business.industry} onChange={(e) => setBusiness({ ...business, industry: e.target.value })} /></Field>
                  <Field label="Telefone"><input className={field} value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} /></Field>
                  <Field label="E-mail"><input type="email" className={field} value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} /></Field>
                  <Field label="Endereço" className="sm:col-span-2"><input className={field} value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} /></Field>
                  <Field label="Bairro"><input className={field} value={business.storeDistrict} onChange={(e) => setBusiness({ ...business, storeDistrict: e.target.value })} /></Field>
                  <Field label="CEP"><input className={field} value={business.zipCode} onChange={(e) => setBusiness({ ...business, zipCode: e.target.value })} /></Field>
                  <Field label="Cidade"><input className={field} value={business.city} onChange={(e) => setBusiness({ ...business, city: e.target.value })} /></Field>
                  <Field label="UF"><input className={field} maxLength={2} value={business.state} onChange={(e) => setBusiness({ ...business, state: e.target.value.toUpperCase() })} /></Field>
                </div>
              </Step>
            )}

            {step === "brand" && (
              <Step title="Identidade visual" description="Defina a apresentação inicial da loja. Você poderá refinar tudo depois no painel." icon={ImageIcon}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Slogan" className="sm:col-span-2"><input className={field} value={brand.slogan} onChange={(e) => setBrand({ ...brand, slogan: e.target.value })} /></Field>
                  <Field label="Título de boas-vindas" className="sm:col-span-2"><input className={field} value={brand.welcomeTitle} onChange={(e) => setBrand({ ...brand, welcomeTitle: e.target.value })} /></Field>
                  <Field label="Texto de boas-vindas" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" value={brand.welcomeText} onChange={(e) => setBrand({ ...brand, welcomeText: e.target.value })} /></Field>
                  <ColorField label="Cor principal" value={brand.primaryColor} onChange={(value) => setBrand({ ...brand, primaryColor: value })} />
                  <ColorField label="Cor secundária" value={brand.secondaryColor} onChange={(value) => setBrand({ ...brand, secondaryColor: value })} />
                  <ColorField label="Cor de fundo" value={brand.backgroundColor} onChange={(value) => setBrand({ ...brand, backgroundColor: value })} />
                  <div />
                  <Field label="URL da logo" className="sm:col-span-2"><input className={field} placeholder="Opcional" value={brand.logoImage} onChange={(e) => setBrand({ ...brand, logoImage: e.target.value })} /></Field>
                  <Field label="URL da capa" className="sm:col-span-2"><input className={field} placeholder="Opcional" value={brand.coverImage} onChange={(e) => setBrand({ ...brand, coverImage: e.target.value })} /></Field>
                </div>
              </Step>
            )}

            {step === "hours" && (
              <Step title="Horários" description="Informe quando a loja opera. Os horários podem ser alterados posteriormente." icon={Clock3}>
                <div className="space-y-2">
                  {hours.map((item, index) => (
                    <div key={item.day} className="grid items-center gap-3 rounded-2xl border border-gray-200 p-3 sm:grid-cols-[140px_1fr_1fr]">
                      <label className="flex items-center gap-2 text-sm font-black text-gray-800">
                        <input type="checkbox" checked={item.enabled} onChange={(e) => updateHour(index, { enabled: e.target.checked })} />
                        {item.label}
                      </label>
                      <input type="time" className={field} disabled={!item.enabled} value={item.open} onChange={(e) => updateHour(index, { open: e.target.value })} />
                      <input type="time" className={field} disabled={!item.enabled} value={item.close} onChange={(e) => updateHour(index, { close: e.target.value })} />
                    </div>
                  ))}
                </div>
              </Step>
            )}

            {step === "fulfillment" && (
              <Step title="Entrega e retirada" description="Escolha como o cliente receberá o pedido. A loja ainda não ficará pública nesta etapa." icon={Truck}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Choice checked={fulfillment.pickupEnabled} onChange={(checked) => setFulfillment({ ...fulfillment, pickupEnabled: checked })} title="Retirada" description="Cliente busca o pedido na loja." icon={MapPin} />
                  <Choice checked={fulfillment.deliveryEnabled} disabled={!onboarding.billing.deliveryIncluded} onChange={(checked) => setFulfillment({ ...fulfillment, deliveryEnabled: checked })} title="Entrega" description={onboarding.billing.deliveryIncluded ? "Use delivery próprio e regras de entrega." : "Este recurso não está incluído no plano atual."} icon={Truck} />
                  <Field label="Pedido mínimo"><input type="number" min="0" step="0.01" className={field} value={fulfillment.minimumOrder} onChange={(e) => setFulfillment({ ...fulfillment, minimumOrder: Number(e.target.value) })} /></Field>
                  <Field label="Retirada — preparo (min)"><input type="number" min="5" className={field} value={fulfillment.pickupLeadMinutes} onChange={(e) => setFulfillment({ ...fulfillment, pickupLeadMinutes: Number(e.target.value) })} /></Field>
                  {fulfillment.deliveryEnabled && <>
                    <Field label="Entrega mínima (min)"><input type="number" min="5" className={field} value={fulfillment.deliveryMinMinutes} onChange={(e) => setFulfillment({ ...fulfillment, deliveryMinMinutes: Number(e.target.value) })} /></Field>
                    <Field label="Entrega máxima (min)"><input type="number" min="5" className={field} value={fulfillment.deliveryMaxMinutes} onChange={(e) => setFulfillment({ ...fulfillment, deliveryMaxMinutes: Number(e.target.value) })} /></Field>
                  </>}
                </div>
              </Step>
            )}

            {step === "catalog" && (
              <Step title="Primeiros produtos" description="Cadastre ao menos um produto ativo. Depois você poderá montar o cardápio completo no painel." icon={ShoppingBag}>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-black">Produtos ativos: {onboarding.catalog.activeProducts}</p>
                  <p className="mt-1 text-xs">O servidor exige pelo menos um produto ativo para publicar a loja.</p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <Field label="Produto"><input className={field} placeholder="Ex.: Pizza Calabresa" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} /></Field>
                  <Field label="Categoria"><input className={field} placeholder="Ex.: Pizzas" value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} /></Field>
                  <Field label="Preço"><input className={field} inputMode="decimal" placeholder="39,90" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} /></Field>
                </div>
                <button type="button" disabled={busy} onClick={createProduct} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white disabled:opacity-50">
                  <PackagePlus className="h-4 w-4" /> Cadastrar produto
                </button>
              </Step>
            )}

            {step === "publish" && (
              <Step title="Publicar loja" description="O servidor fará uma última validação da assinatura, operação e catálogo antes de liberar pedidos online." icon={Rocket}>
                <div className={`rounded-2xl border p-5 ${onboarding.readiness.readyToPublish ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className="font-black text-gray-950">{onboarding.readiness.readyToPublish ? "Tudo pronto para publicar" : "Ainda há itens pendentes"}</p>
                  {onboarding.readiness.pending.length > 0 && (
                    <p className="mt-2 text-sm text-amber-900">{onboarding.readiness.pending.join(" · ")}</p>
                  )}
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <Status label="Assinatura ativa" ok={onboarding.billing.active} />
                    <Status label="Produto ativo" ok={onboarding.catalog.activeProducts > 0} />
                    <Status label="Dados comerciais" ok={completed.has("business")} />
                    <Status label="Identidade visual" ok={completed.has("brand")} />
                    <Status label="Horários" ok={completed.has("hours")} />
                    <Status label="Entrega/retirada" ok={completed.has("fulfillment")} />
                  </div>
                </div>
              </Step>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">Loja: <span className="font-bold text-gray-700">{onboarding.organization.name}</span></p>
              <button
                type="button"
                disabled={busy || (step === "publish" && !onboarding.readiness.readyToPublish)}
                onClick={() => save(step)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : step === "publish" ? <Rocket className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {busy ? "Salvando..." : step === "publish" ? "Publicar loja" : step === "catalog" ? "Validar produtos e continuar" : "Salvar e continuar"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function Step({ title, description, icon: Icon, children }: { title: string; description: string; icon: LucideIcon; children: ReactNode }) {
  return <div>
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Icon className="h-5 w-5" /></div>
      <div><h2 className="text-xl font-black text-gray-950">{title}</h2><p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p></div>
    </div>
    {children}
  </div>
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={className}><span className={labelClass}>{label}</span>{children}</label>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><div className="flex gap-2"><input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 rounded-xl border border-gray-200 bg-white p-1" /><input className={field} value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} /></div></Field>
}

function Choice({ checked, disabled = false, onChange, title, description, icon: Icon }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; title: string; description: string; icon: LucideIcon }) {
  return <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${checked ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
    <Icon className="mt-0.5 h-5 w-5 text-amber-700" />
    <span><span className="block text-sm font-black text-gray-900">{title}</span><span className="mt-1 block text-xs leading-relaxed text-gray-500">{description}</span></span>
  </label>
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${ok ? "bg-emerald-600 text-white" : "bg-amber-200 text-amber-900"}`}>{ok ? "✓" : "!"}</span><span className="font-semibold text-gray-700">{label}</span></div>
}
