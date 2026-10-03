"use client"

import { type ChangeEvent, type ReactNode, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  ImageIcon,
  LoaderCircle,
  MapPin,
  PackagePlus,
  Rocket,
  Route,
  Settings2,
  ShoppingBag,
  Store,
  Truck,
  Upload,
  WandSparkles,
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
  helper: string
}> = [
  { key: "business", label: "Nome e informações", short: "Sua empresa", icon: Building2, helper: "Nome, slogan, segmento e contato." },
  { key: "brand", label: "Logo e aparência", short: "Logo e visual", icon: ImageIcon, helper: "Logo, capa, cores e apresentação." },
  { key: "location", label: "Localização", short: "Localização", icon: MapPin, helper: "Endereço, bairro, cidade e CEP." },
  { key: "hours", label: "Horários", short: "Horários", icon: Clock3, helper: "Dias e horários de funcionamento." },
  { key: "fulfillment", label: "Entrega e retirada", short: "Atendimento", icon: Truck, helper: "Como o cliente receberá o pedido." },
  { key: "catalog", label: "Produtos", short: "Produtos", icon: ShoppingBag, helper: "Cadastre ou importe seu cardápio." },
  { key: "publish", label: "Revisar e publicar", short: "Finalizar", icon: Rocket, helper: "Confira tudo antes de liberar a loja." },
]

const field = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
const labelClass = "mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500"

export function CommercialOnboarding({
  initialOnboarding,
}: {
  initialOnboarding: CommercialOnboardingSnapshot
}) {
  const router = useRouter()
  const [onboarding, setOnboarding] = useState(initialOnboarding)
  const [guideMode, setGuideModeState] = useState<"guided" | "self" | null>(initialOnboarding.state.guideMode)
  const initialStep = initialOnboarding.state.currentStep === "published"
    ? "publish"
    : initialOnboarding.state.currentStep
  const [step, setStep] = useState<CommercialOnboardingStep>(initialStep)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const settings = initialOnboarding.settings
  const [business, setBusiness] = useState({
    storeName: settings.storeName,
    slogan: settings.slogan,
    legalName: initialOnboarding.organization.legalName,
    industry: initialOnboarding.organization.industry,
    phone: initialOnboarding.organization.phone || settings.phone,
    email: initialOnboarding.organization.email,
  })
  const [brand, setBrand] = useState({
    welcomeTitle: settings.welcomeTitle,
    welcomeText: settings.welcomeText,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    backgroundColor: settings.backgroundColor,
    logoImage: settings.logoImage,
    coverImage: settings.coverImage,
  })
  const [location, setLocation] = useState({
    address: settings.address,
    storeDistrict: settings.storeDistrict,
    city: settings.city,
    state: settings.state,
    zipCode: settings.zipCode,
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
  const completedCount = steps.filter((item) => completed.has(item.key)).length
  const progress = Math.min(100, Math.round((completedCount / steps.length) * 100))
  const activeStepIndex = Math.max(0, steps.findIndex((item) => item.key === step))

  async function refresh() {
    const response = await fetch("/api/admin/commercial-onboarding", { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o passo a passo.")
    setOnboarding(payload.onboarding)
    return payload.onboarding as CommercialOnboardingSnapshot
  }

  async function chooseGuideMode(mode: "guided" | "self") {
    if (busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/commercial-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guide-mode", mode }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar sua escolha.")
      const next = payload.onboarding as CommercialOnboardingSnapshot
      setOnboarding(next)
      setGuideModeState(mode)
      if (mode === "self") {
        router.replace("/admin")
        router.refresh()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível continuar.")
    } finally {
      setBusy(false)
    }
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
          : current === "location"
            ? location
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
      setNotice("Pronto. Essa etapa foi salva.")
      if (next.state.currentStep !== "published") {
        setStep(next.state.currentStep)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar esta etapa.")
    } finally {
      setBusy(false)
    }
  }

  async function uploadBrand(event: ChangeEvent<HTMLInputElement>, target: "logo" | "cover") {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(target)
    setError("")
    setNotice("")
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/uploads/store-image", { method: "POST", body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar a imagem.")
      setBrand((current) => ({
        ...current,
        [target === "logo" ? "logoImage" : "coverImage"]: String(payload.url || ""),
      }))
      setNotice(target === "logo" ? "Logo enviada. Agora salve esta etapa." : "Capa enviada. Agora salve esta etapa.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a imagem.")
    } finally {
      setUploading(null)
      event.target.value = ""
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
      setNotice("Produto cadastrado. Você já pode continuar ou cadastrar outro.")
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

  if (guideMode === null) {
    return (
      <OnboardingChoice
        busy={busy}
        error={error}
        storeName={onboarding.organization.name}
        onChoose={chooseGuideMode}
      />
    )
  }

  if (guideMode === "self") {
    return (
      <main className="min-h-screen bg-[#fff8ef] px-4 py-10 text-gray-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-orange-200 bg-white p-7 shadow-xl shadow-orange-950/5 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><Settings2 className="h-7 w-7" /></div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-orange-700">Configuração livre</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Você escolheu configurar por conta própria.</h1>
          <p className="mt-4 text-base leading-7 text-gray-600">Sem problema. O painel completo fica disponível para você configurar no seu ritmo. Quando quiser, volte aqui e retome o tutorial de onde estiver.</p>
          {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button type="button" disabled={busy} onClick={() => chooseGuideMode("guided")} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-60"><Route className="h-4 w-4" />Retomar passo a passo</button>
            <button type="button" onClick={() => router.replace("/admin")} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 text-sm font-black text-stone-700"><ArrowRight className="h-4 w-4" />Ir para o painel</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-6 text-gray-950 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[30px] border border-orange-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"><Compass className="h-6 w-6" /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-700">SaborFlow · início guiado</p>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">Vamos deixar sua empresa pronta, passo a passo</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">Você não precisa saber onde cada configuração fica. Complete uma etapa por vez e o SaborFlow leva você até a próxima.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <p className="font-black text-gray-900">{onboarding.billing.planName || "Plano atual"}</p>
                <p className="mt-1 text-xs text-gray-500">Etapa {activeStepIndex + 1} de {steps.length} · {progress}% concluído</p>
              </div>
              <button type="button" disabled={busy} onClick={() => chooseGuideMode("self")} className="rounded-xl px-4 py-2 text-xs font-black text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50">Pular tutorial e configurar sozinho</button>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-orange-600 transition-all" style={{ width: `${progress}%` }} /></div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[285px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-orange-200 bg-white p-3 shadow-sm lg:sticky lg:top-5">
            <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Seu roteiro</p>
            {steps.map((item, index) => {
              const Icon = item.icon
              const done = completed.has(item.key)
              const active = step === item.key
              return (
                <button key={item.key} type="button" onClick={() => setStep(item.key)} className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-orange-50 text-orange-950 ring-1 ring-orange-100" : "hover:bg-gray-50"}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-white text-orange-700 shadow-sm" : "bg-gray-100 text-gray-500"}`}>{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Passo {index + 1}</span>
                    <span className="block text-sm font-black">{item.short}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-gray-500">{item.helper}</span>
                  </span>
                </button>
              )
            })}
          </aside>

          <section className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm sm:p-7">
            {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
            {notice && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</div>}

            {step === "business" && (
              <Step title="Comece pela identidade da empresa" description="Primeiro, diga ao SaborFlow quem é sua empresa. Essas informações aparecem em diferentes partes do sistema e ajudam a identificar sua operação." tip="Use o nome pelo qual seus clientes já conhecem a empresa. Você poderá alterar tudo depois." icon={Building2}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome comercial" className="sm:col-span-2"><input className={field} value={business.storeName} onChange={(e) => setBusiness({ ...business, storeName: e.target.value })} placeholder="Ex.: Cris Salgados" /></Field>
                  <Field label="Slogan / frase curta" className="sm:col-span-2"><input className={field} value={business.slogan} onChange={(e) => setBusiness({ ...business, slogan: e.target.value })} placeholder="Ex.: Sabor que faz parte dos seus momentos" /></Field>
                  <Field label="Razão social"><input className={field} value={business.legalName} onChange={(e) => setBusiness({ ...business, legalName: e.target.value })} /></Field>
                  <Field label="Segmento"><input className={field} placeholder="Ex.: Salgaderia" value={business.industry} onChange={(e) => setBusiness({ ...business, industry: e.target.value })} /></Field>
                  <Field label="Telefone"><input className={field} value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} placeholder="(99) 99999-9999" /></Field>
                  <Field label="E-mail"><input type="email" className={field} value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} /></Field>
                </div>
              </Step>
            )}

            {step === "brand" && (
              <Step title="Coloque a cara da sua empresa" description="Agora adicione sua logo e escolha a aparência inicial. Isso ajuda o cardápio e a página pública a parecerem realmente da sua marca." tip="Não tem uma capa pronta? Pode pular a capa agora. A logo é o item mais importante desta etapa." icon={ImageIcon}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <ImageUploadCard title="Logo da empresa" value={brand.logoImage} busy={uploading === "logo"} onUpload={(event) => uploadBrand(event, "logo")} />
                  <ImageUploadCard title="Imagem de capa" value={brand.coverImage} busy={uploading === "cover"} onUpload={(event) => uploadBrand(event, "cover")} />
                  <ColorField label="Cor principal" value={brand.primaryColor} onChange={(value) => setBrand({ ...brand, primaryColor: value })} />
                  <ColorField label="Cor secundária" value={brand.secondaryColor} onChange={(value) => setBrand({ ...brand, secondaryColor: value })} />
                  <ColorField label="Fundo" value={brand.backgroundColor} onChange={(value) => setBrand({ ...brand, backgroundColor: value })} />
                  <div className="hidden sm:block" />
                  <Field label="Título de boas-vindas" className="sm:col-span-2"><input className={field} value={brand.welcomeTitle} onChange={(e) => setBrand({ ...brand, welcomeTitle: e.target.value })} placeholder="Ex.: Bem-vindo!" /></Field>
                  <Field label="Mensagem para o cliente" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" value={brand.welcomeText} onChange={(e) => setBrand({ ...brand, welcomeText: e.target.value })} /></Field>
                </div>
              </Step>
            )}

            {step === "location" && (
              <Step title="Onde sua empresa funciona?" description="Cadastre a localização da loja. Ela será usada para retirada, referências de entrega e informações mostradas ao cliente." tip="Confira principalmente cidade e UF. Depois você pode configurar áreas e taxas de entrega com mais detalhes." icon={MapPin}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Endereço" className="sm:col-span-2"><input className={field} value={location.address} onChange={(e) => setLocation({ ...location, address: e.target.value })} placeholder="Rua, avenida, número" /></Field>
                  <Field label="Bairro"><input className={field} value={location.storeDistrict} onChange={(e) => setLocation({ ...location, storeDistrict: e.target.value })} /></Field>
                  <Field label="CEP"><input className={field} inputMode="numeric" value={location.zipCode} onChange={(e) => setLocation({ ...location, zipCode: e.target.value })} /></Field>
                  <Field label="Cidade"><input className={field} value={location.city} onChange={(e) => setLocation({ ...location, city: e.target.value })} /></Field>
                  <Field label="UF"><input className={field} maxLength={2} value={location.state} onChange={(e) => setLocation({ ...location, state: e.target.value.toUpperCase() })} /></Field>
                </div>
              </Step>
            )}

            {step === "hours" && (
              <Step title="Defina quando a loja atende" description="Marque os dias em que você funciona e informe os horários. Isso evita pedidos fora do período correto." tip="Comece com o horário principal. Depois você pode fazer ajustes mais detalhados nas configurações da loja." icon={Clock3}>
                <div className="space-y-2">
                  {hours.map((item, index) => (
                    <div key={item.day} className="grid items-center gap-3 rounded-2xl border border-gray-200 p-3 sm:grid-cols-[140px_1fr_1fr]">
                      <label className="flex items-center gap-2 text-sm font-black text-gray-800"><input type="checkbox" checked={item.enabled} onChange={(e) => updateHour(index, { enabled: e.target.checked })} />{item.label}</label>
                      <input type="time" className={field} disabled={!item.enabled} value={item.open} onChange={(e) => updateHour(index, { open: e.target.value })} />
                      <input type="time" className={field} disabled={!item.enabled} value={item.close} onChange={(e) => updateHour(index, { close: e.target.value })} />
                    </div>
                  ))}
                </div>
              </Step>
            )}

            {step === "fulfillment" && (
              <Step title="Como o cliente recebe o pedido?" description="Escolha retirada, entrega ou as duas opções. Depois informe tempos aproximados para o sistema orientar melhor o cliente." tip="Se você ainda não trabalha com delivery, deixe apenas retirada. É possível ativar entrega depois." icon={Truck}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Choice checked={fulfillment.pickupEnabled} onChange={(checked) => setFulfillment({ ...fulfillment, pickupEnabled: checked })} title="Retirada" description="Cliente busca o pedido na loja." icon={MapPin} />
                  <Choice checked={fulfillment.deliveryEnabled} disabled={!onboarding.billing.deliveryIncluded} onChange={(checked) => setFulfillment({ ...fulfillment, deliveryEnabled: checked })} title="Entrega" description={onboarding.billing.deliveryIncluded ? "Organize pedidos enviados por delivery." : "Este recurso não está incluído no plano atual."} icon={Truck} />
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
              <Step title="Agora coloque seus produtos" description="Você pode cadastrar o primeiro produto aqui ou aproveitar seu cadastro antigo. Não precisa perder horas refazendo tudo manualmente." tip="Se você já usa outro sistema, prefira Importar cadastro antigo. Você pode enviar link, prints e fotos para organizar a migração." icon={ShoppingBag}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Seu progresso</p>
                    <p className="mt-2 text-2xl font-black">{onboarding.catalog.activeProducts} produto(s) ativo(s)</p>
                    <p className="mt-2 text-sm leading-6">Você precisa de pelo menos um produto ativo para publicar a loja. Depois pode cadastrar quantos precisar dentro do seu plano.</p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-orange-950">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Já tem outro sistema?</p>
                    <p className="mt-2 font-black">Não comece do zero.</p>
                    <p className="mt-2 text-sm leading-6 text-orange-900/80">Envie o link antigo, prints e fotos para preparar sua migração.</p>
                    <a href="/admin/importar-cadastro" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white"><Upload className="h-4 w-4" />Importar cadastro antigo</a>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="font-black text-gray-950">Ou cadastre um produto agora</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Produto"><input className={field} placeholder="Ex.: Coxinha" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} /></Field>
                    <Field label="Categoria"><input className={field} placeholder="Ex.: Salgados" value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} /></Field>
                    <Field label="Preço"><input className={field} inputMode="decimal" placeholder="7,00" value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} /></Field>
                  </div>
                  <button type="button" disabled={busy} onClick={createProduct} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white disabled:opacity-50"><PackagePlus className="h-4 w-4" />Cadastrar produto</button>
                </div>
              </Step>
            )}

            {step === "publish" && (
              <Step title="Última conferência" description="Antes de colocar sua loja no ar, o SaborFlow confere se o essencial está pronto. Depois da publicação, você continua podendo alterar tudo no painel." tip="Se algo estiver pendente, clique na etapa correspondente no menu ao lado e complete antes de publicar." icon={Rocket}>
                <div className={`rounded-2xl border p-5 ${onboarding.readiness.readyToPublish ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${onboarding.readiness.readyToPublish ? "bg-emerald-600 text-white" : "bg-orange-100 text-orange-700"}`}>{onboarding.readiness.readyToPublish ? <CheckCircle2 className="h-5 w-5" /> : <WandSparkles className="h-5 w-5" />}</div>
                    <div><p className="font-black text-gray-950">{onboarding.readiness.readyToPublish ? "Tudo pronto para publicar" : "Ainda há itens pendentes"}</p>{onboarding.readiness.pending.length > 0 && <p className="mt-1 text-sm text-orange-900">{onboarding.readiness.pending.join(" · ")}</p>}</div>
                  </div>
                  <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                    <Status label="Assinatura ativa" ok={onboarding.billing.active} />
                    <Status label="Produto ativo" ok={onboarding.catalog.activeProducts > 0} />
                    <Status label="Nome e informações" ok={completed.has("business")} />
                    <Status label="Logo e aparência" ok={completed.has("brand")} />
                    <Status label="Localização" ok={completed.has("location")} />
                    <Status label="Horários" ok={completed.has("hours")} />
                    <Status label="Entrega/retirada" ok={completed.has("fulfillment")} />
                  </div>
                </div>
              </Step>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs text-gray-500">Loja: <span className="font-bold text-gray-700">{onboarding.organization.name}</span></p><p className="mt-1 text-[11px] text-gray-400">Você pode sair e continuar depois. O progresso fica salvo.</p></div>
              <button type="button" disabled={busy || uploading !== null || (step === "publish" && !onboarding.readiness.readyToPublish)} onClick={() => save(step)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-black text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : step === "publish" ? <Rocket className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {busy ? "Salvando..." : step === "publish" ? "Publicar minha loja" : step === "catalog" ? "Validar produtos e continuar" : "Salvar e ir para o próximo passo"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function OnboardingChoice({ busy, error, storeName, onChoose }: { busy: boolean; error: string; storeName: string; onChoose: (mode: "guided" | "self") => void }) {
  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-10 text-gray-950 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-700"><WandSparkles className="h-4 w-4" />Primeiro acesso · {storeName}</span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Como você prefere começar?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">Se esta é sua primeira vez no SaborFlow, recomendamos o passo a passo. Ele ensina a ordem certa e evita que você precise procurar cada configuração sozinho.</p>
        </div>
        {error && <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => onChoose("guided")} className="group rounded-[30px] border-2 border-orange-300 bg-white p-7 text-left shadow-xl shadow-orange-950/5 transition hover:-translate-y-1 hover:border-orange-500 disabled:opacity-60 sm:p-8">
            <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"><Route className="h-6 w-6" /></span><span className="rounded-full bg-orange-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">Recomendado</span></div>
            <h2 className="mt-6 text-2xl font-black">Quero o passo a passo</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">O SaborFlow mostra o que fazer primeiro, explica cada função e salva seu progresso até sua empresa ficar pronta.</p>
            <div className="mt-5 space-y-2 text-sm font-bold text-gray-700"><p>✓ Nome e apresentação</p><p>✓ Logo e aparência</p><p>✓ Localização e horários</p><p>✓ Entrega, produtos e publicação</p></div>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-orange-700">Começar tutorial <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
          </button>
          <button type="button" disabled={busy} onClick={() => onChoose("self")} className="group rounded-[30px] border border-gray-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg disabled:opacity-60 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-700"><Settings2 className="h-6 w-6" /></span>
            <h2 className="mt-6 text-2xl font-black">Prefiro configurar sozinho</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">Entre direto no painel e configure no seu ritmo. O tutorial continua disponível caso você queira ajuda depois.</p>
            <div className="mt-5 space-y-2 text-sm text-gray-500"><p>• Acesso direto às configurações</p><p>• Nenhuma etapa guiada obrigatória</p><p>• Pode retomar o tutorial a qualquer momento</p></div>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-gray-700">Ir para o painel <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
          </button>
        </div>
        {busy && <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" />Salvando sua escolha...</div>}
      </div>
    </main>
  )
}

function Step({ title, description, tip, icon: Icon, children }: { title: string; description: string; tip: string; icon: LucideIcon; children: ReactNode }) {
  return <div>
    <div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-gray-950">{title}</h2><p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p></div></div>
    <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900"><strong>Dica:</strong> {tip}</div>
    {children}
  </div>
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={className}><span className={labelClass}>{label}</span>{children}</label>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><div className="flex gap-2"><input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 rounded-xl border border-gray-200 bg-white p-1" /><input className={field} value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} /></div></Field>
}

function ImageUploadCard({ title, value, busy, onUpload }: { title: string; value: string; busy: boolean; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-gray-500">{title}</p>
    <div className="mt-3 flex min-h-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white">
      {value ? <img src={value} alt={title} className="max-h-28 max-w-full object-contain p-2" /> : <div className="text-center text-gray-400"><ImageIcon className="mx-auto h-7 w-7" /><p className="mt-2 text-xs font-bold">Nenhuma imagem enviada</p></div>}
    </div>
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-gray-800 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {busy ? "Enviando..." : value ? "Trocar imagem" : "Enviar imagem"}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={onUpload} />
    </label>
  </div>
}

function Choice({ checked, disabled = false, onChange, title, description, icon: Icon }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; title: string; description: string; icon: LucideIcon }) {
  return <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${checked ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1" /><Icon className="mt-0.5 h-5 w-5 text-orange-700" /><span><span className="block text-sm font-black text-gray-900">{title}</span><span className="mt-1 block text-xs leading-relaxed text-gray-500">{description}</span></span></label>
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${ok ? "bg-emerald-600 text-white" : "bg-orange-200 text-orange-900"}`}>{ok ? "✓" : "!"}</span><span className="font-semibold text-gray-700">{label}</span></div>
}
