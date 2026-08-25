import Link from "next/link"
import type { CSSProperties } from "react"
import {
  ArrowRight,
  Bike,
  Clock3,
  Globe2,
  MapPin,
  MessageCircle,
  Navigation,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react"
import {
  FacebookBrandIcon,
  InstagramBrandIcon,
  YouTubeBrandIcon,
} from "@/components/icons/social-brand-icons"
import type { Product, StoreSettings } from "@/lib/types"

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)

function externalUrl(value?: string | null) {
  const clean = String(value || "").trim()
  if (!clean) return ""
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
}

function withBase(basePath: string, suffix = "") {
  const base = basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : ""
  if (!suffix) return base || "/"
  return `${base}/${suffix.replace(/^\//, "")}` || "/"
}

export function StoreLandingPage({
  products,
  settings,
  openNow,
  basePath,
}: {
  products: Product[]
  settings: StoreSettings
  openNow: boolean
  basePath: string
}) {
  const catalogPath = withBase(basePath, "cardapio")
  const orderPath = withBase(basePath, "pedir")
  const address = [
    settings.address,
    settings.storeDistrict,
    settings.city,
    settings.state,
    settings.zipCode,
  ]
    .filter(Boolean)
    .join(", ")
  const whatsapp =
    externalUrl(settings.whatsappUrl) ||
    (settings.whatsapp
      ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
      : "")
  const gallery = Array.isArray(settings.galleryImages)
    ? settings.galleryImages.filter(Boolean).slice(0, 8)
    : []
  const activeProducts = products.filter((item) => item.active)
  const featured = activeProducts.filter((item) => item.featured)
  const highlights = (featured.length ? featured : activeProducts).slice(0, 6)
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const zonedWeekDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: settings.timeZone || "America/Sao_Paulo",
  }).format(new Date())
  const today = Math.max(0, weekDays.indexOf(zonedWeekDay))
  const todayHours = settings.businessHours?.find((item) => item.day === today)
  const hasCoordinates =
    Number.isFinite(Number(settings.storeLatitude)) &&
    Number.isFinite(Number(settings.storeLongitude)) &&
    (Number(settings.storeLatitude) !== 0 || Number(settings.storeLongitude) !== 0)
  const mapQuery = hasCoordinates
    ? `${Number(settings.storeLatitude)},${Number(settings.storeLongitude)}`
    : address
  const mapEmbed = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`
    : ""
  const directionsUrl = mapQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`
    : ""
  const heroTitle = settings.welcomeTitle?.trim() || `Bem-vindo à ${settings.storeName}`
  const heroText =
    settings.welcomeText?.trim() ||
    settings.slogan?.trim() ||
    "Conheça nossa empresa, veja o cardápio e faça seu pedido online."
  const aboutTitle = settings.aboutTitle?.trim() || `Sobre a ${settings.storeName}`
  const aboutText = settings.aboutText?.trim() || settings.slogan?.trim() || ""
  const galleryTitle = settings.galleryTitle?.trim() || "Conheça nosso espaço"

  return (
    <div
      className="min-h-screen bg-white text-gray-950"
      style={{
        "--brand-primary": settings.primaryColor,
        "--brand-secondary": settings.secondaryColor,
      } as CSSProperties}
    >
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={withBase(basePath)} className="flex min-w-0 items-center gap-3">
            {settings.logoImage ? (
              <img
                src={settings.logoImage}
                alt={settings.storeName}
                className="h-10 w-10 rounded-xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white"
                style={{ backgroundColor: settings.primaryColor }}
              >
                <Store className="h-5 w-5" />
              </span>
            )}
            <span className="truncate text-sm font-black sm:text-base">{settings.storeName}</span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-bold text-gray-600 md:flex">
            <a href="#sobre" className="hover:text-gray-950">Sobre</a>
            {gallery.length > 0 && <a href="#galeria" className="hover:text-gray-950">Fotos</a>}
            <a href="#localizacao" className="hover:text-gray-950">Localização</a>
            <Link href={catalogPath} className="hover:text-gray-950">Cardápio</Link>
          </nav>

          <Link
            href={orderPath}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black text-white shadow-sm sm:text-sm"
            style={{ backgroundColor: settings.primaryColor }}
          >
            <ShoppingBag className="h-4 w-4" />
            Pedir
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
          <div
            className="relative min-h-[470px] overflow-hidden rounded-[30px] bg-gray-950 sm:min-h-[540px] lg:min-h-[600px]"
            style={{
              background: settings.coverImage
                ? undefined
                : `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`,
            }}
          >
            {settings.coverImage && (
              <img
                src={settings.coverImage}
                alt={`Ambiente da ${settings.storeName}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
            <div className="relative z-10 flex min-h-[470px] max-w-3xl flex-col justify-end p-6 text-white sm:min-h-[540px] sm:p-10 lg:min-h-[600px] lg:p-14">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black backdrop-blur ${
                    openNow
                      ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-50"
                      : settings.acceptingOrders
                        ? "border-amber-300/40 bg-amber-500/20 text-amber-50"
                        : "border-white/20 bg-white/10 text-white/80"
                  }`}
                >
                  {openNow
                    ? "● Aberto agora"
                    : settings.acceptingOrders
                      ? "● Fechado agora · agendamentos disponíveis"
                      : "● Pedidos pausados"}
                </span>
                {settings.deliveryEnabled && (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    Entrega {settings.deliveryMinMinutes}–{settings.deliveryMaxMinutes} min
                  </span>
                )}
              </div>

              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">{settings.storeName}</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">{heroTitle}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">{heroText}</p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={orderPath}
                  className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-lg"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Fazer pedido
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={catalogPath}
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white backdrop-blur hover:bg-white/15"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Ver cardápio
                </Link>
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-black text-white backdrop-blur hover:bg-white/15"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-20 mx-3 -mt-8 grid gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-xl shadow-black/5 sm:mx-8 sm:grid-cols-3 sm:p-5">
            <div className="flex items-start gap-3 rounded-2xl p-2">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Clock3 className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">Hoje</p>
                <p className="mt-0.5 text-sm font-black text-gray-900">
                  {todayHours?.enabled ? `${todayHours.open} – ${todayHours.close}` : "Fechado"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl p-2">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Bike className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">Atendimento</p>
                <p className="mt-0.5 text-sm font-black text-gray-900">
                  {settings.deliveryEnabled && settings.pickupEnabled
                    ? "Entrega e retirada"
                    : settings.deliveryEnabled
                      ? "Entrega"
                      : settings.pickupEnabled
                        ? "Retirada"
                        : "Consulte a loja"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl p-2">
              <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><MapPin className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">Onde estamos</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-black text-gray-900">{address || "Localização disponível em breve"}</p>
              </div>
            </div>
          </div>
        </section>

        {highlights.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: settings.primaryColor }}>Mais pedidos</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Destaques do cardápio</h2>
                <p className="mt-2 text-sm text-gray-500">Uma amostra do que você encontra por aqui.</p>
              </div>
              <Link href={catalogPath} className="inline-flex items-center gap-2 text-sm font-black" style={{ color: settings.primaryColor }}>
                Ver cardápio completo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((product) => (
                <Link key={product.id} href={orderPath} className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="aspect-[16/10] overflow-hidden bg-gray-100">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">🍽️</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black">{product.name}</h3>
                        {product.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">{product.description}</p>}
                      </div>
                      <span className="whitespace-nowrap text-sm font-black" style={{ color: settings.primaryColor }}>{money(product.price)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="sobre" className="border-y border-gray-100 bg-gray-50/70">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: settings.primaryColor }}>Nossa empresa</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{aboutTitle}</h2>
              {aboutText ? (
                <p className="mt-5 whitespace-pre-line text-base leading-8 text-gray-600">{aboutText}</p>
              ) : (
                <p className="mt-5 text-base leading-8 text-gray-600">
                  Conheça nosso cardápio, veja como chegar e fale com a equipe. Será um prazer receber você e fazer parte do seu próximo pedido.
                </p>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={catalogPath} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black text-white" style={{ backgroundColor: settings.primaryColor }}>
                  <UtensilsCrossed className="h-4 w-4" /> Cardápio
                </Link>
                {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black"><MessageCircle className="h-4 w-4" /> Falar no WhatsApp</a>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(gallery.length ? gallery.slice(0, 3) : [settings.coverImage, settings.logoImage].filter(Boolean)).map((image, index) => (
                <img
                  key={`${image}-${index}`}
                  src={image}
                  alt={`${settings.storeName} - foto ${index + 1}`}
                  className={`${index === 0 ? "sm:col-span-2 aspect-[16/8]" : "aspect-[4/3]"} h-full w-full rounded-3xl object-cover`}
                />
              ))}
              {!gallery.length && !settings.coverImage && !settings.logoImage && (
                <div className="sm:col-span-2 flex aspect-[16/8] items-center justify-center rounded-3xl bg-white text-gray-300 ring-1 ring-gray-200"><Store className="h-14 w-14" /></div>
              )}
            </div>
          </div>
        </section>

        {gallery.length > 0 && (
          <section id="galeria" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: settings.primaryColor }}>Fotos</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{galleryTitle}</h2>
              <p className="mt-2 text-sm text-gray-500">Um pouco do ambiente, dos produtos e da experiência da empresa.</p>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
              {gallery.map((image, index) => (
                <div key={`${image}-${index}`} className={`${index === 0 ? "col-span-2 row-span-2" : ""} overflow-hidden rounded-2xl bg-gray-100`}>
                  <img src={image} alt={`${settings.storeName} - galeria ${index + 1}`} className="h-full min-h-40 w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="localizacao" className="bg-gray-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:items-stretch">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Visite a gente</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Localização e horários</h2>
              {address && <p className="mt-5 flex items-start gap-3 text-sm leading-6 text-white/75"><MapPin className="mt-0.5 h-5 w-5 shrink-0" />{address}</p>}
              <div className="mt-6 space-y-2">
                {(settings.businessHours || []).map((item) => (
                  <div key={item.day} className="flex items-center justify-between gap-4 border-b border-white/10 py-2 text-sm">
                    <span className="font-bold text-white/80">{item.label}</span>
                    <span className="text-white/60">{item.enabled ? `${item.open} – ${item.close}` : "Fechado"}</span>
                  </div>
                ))}
              </div>
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-gray-950">
                  <Navigation className="h-4 w-4" /> Como chegar
                </a>
              )}
            </div>
            <div className="min-h-[360px] overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10">
              {mapEmbed ? (
                <iframe
                  title={`Mapa - ${settings.storeName}`}
                  src={mapEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full min-h-[360px] w-full border-0"
                />
              ) : (
                <div className="flex min-h-[360px] items-center justify-center p-8 text-center text-white/40">Cadastre o endereço da empresa para exibir o mapa.</div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-6 rounded-[30px] p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` }}>
            <div>
              <p className="text-sm font-bold text-white/75">Pronto para pedir?</p>
              <h2 className="mt-1 text-3xl font-black">Escolha seus produtos e finalize online.</h2>
            </div>
            <Link href={orderPath} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-gray-950 shadow-lg">
              Fazer pedido <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black">{settings.storeName}</p>
            {settings.slogan && <p className="mt-1 text-sm text-gray-500">{settings.slogan}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600"><MessageCircle className="h-4 w-4" /></a>}
            {settings.instagramUrl && <a href={externalUrl(settings.instagramUrl)} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600"><InstagramBrandIcon className="h-4 w-4" /></a>}
            {settings.facebookUrl && <a href={externalUrl(settings.facebookUrl)} target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600"><FacebookBrandIcon className="h-4 w-4" /></a>}
            {settings.youtubeUrl && <a href={externalUrl(settings.youtubeUrl)} target="_blank" rel="noreferrer" aria-label="YouTube" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600"><YouTubeBrandIcon className="h-4 w-4" /></a>}
            {settings.tiktokUrl && <a href={externalUrl(settings.tiktokUrl)} target="_blank" rel="noreferrer" aria-label="TikTok" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-sm font-black text-gray-600">♪</a>}
            {settings.websiteUrl && <a href={externalUrl(settings.websiteUrl)} target="_blank" rel="noreferrer" aria-label="Site" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600"><Globe2 className="h-4 w-4" /></a>}
          </div>
          <p className="text-xs text-gray-400">Pedidos e presença digital com SaborFlow™</p>
        </div>
      </footer>
    </div>
  )
}
