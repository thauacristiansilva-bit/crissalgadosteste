"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  ImagePlus,
  Instagram,
  MessageCircle,
  Palette,
  Plus,
  Repeat2,
  Save,
  Sparkles,
} from "lucide-react"
import type { StoreSettings } from "@/lib/types"

type Channel = "instagram_feed" | "instagram_story" | "whatsapp_status"
type Recurrence = "none" | "daily" | "weekly"
type PublicationStatus = "draft" | "ready" | "scheduled" | "published" | "cancelled" | "failed"

type Publication = {
  id: string
  title: string
  channel: Channel
  contentType: "flyer" | "image" | "video" | "text"
  caption: string
  cta: string
  mediaUrl?: string
  templateKey?: string
  flyerPayload: Record<string, unknown>
  scheduledAt?: string
  recurrence: Recurrence
  recurrenceDays: number[]
  recurrenceTime?: string
  status: PublicationStatus
  active: boolean
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

type FlyerDraft = {
  template: string
  headline: string
  subtitle: string
  price: string
  badge: string
  cta: string
  background: string
  accent: string
  text: string
  photoDataUrl: string
}

type Draft = {
  title: string
  channel: Channel
  caption: string
  cta: string
  scheduledDate: string
  scheduledTime: string
  recurrence: Recurrence
  recurrenceDays: number[]
  recurrenceTime: string
  status: PublicationStatus
  mediaUrl: string
  flyer: FlyerDraft
}

const dayOptions = [
  [0, "Dom"],
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sab"],
] as const

const templates = [
  { key: "oferta", name: "Oferta do dia", background: "#111827", accent: "#f97316", text: "#ffffff" },
  { key: "combo", name: "Combo promocional", background: "#7c2d12", accent: "#fbbf24", text: "#ffffff" },
  { key: "delivery", name: "Delivery aberto", background: "#064e3b", accent: "#34d399", text: "#ffffff" },
  { key: "cashback", name: "Cashback", background: "#4c1d95", accent: "#c4b5fd", text: "#ffffff" },
  { key: "encomendas", name: "Encomendas", background: "#831843", accent: "#f9a8d4", text: "#ffffff" },
  { key: "destaque", name: "Produto destaque", background: "#0f172a", accent: "#38bdf8", text: "#ffffff" },
]

const readyPosts = [
  {
    name: "Bom dia + pedidos",
    headline: "Já estamos recebendo pedidos!",
    subtitle: "Escolha seus favoritos e faça seu pedido hoje.",
    badge: "PEDIDOS ABERTOS",
    cta: "Peça pelo WhatsApp",
    caption: "Bom dia! 😋 Já estamos recebendo pedidos. Confira o cardápio e garanta seus favoritos!",
    template: "delivery",
  },
  {
    name: "Produto do dia",
    headline: "Destaque de hoje",
    subtitle: "Um dos queridinhos do nosso cardápio.",
    badge: "HOJE",
    cta: "Faça seu pedido",
    caption: "O destaque de hoje está passando no seu feed. 😍 Peça agora e aproveite!",
    template: "destaque",
  },
  {
    name: "Combo",
    headline: "Combo especial",
    subtitle: "Mais sabor para compartilhar e economizar.",
    badge: "COMBO",
    cta: "Chame no WhatsApp",
    caption: "Tem combo especial por aqui! 🔥 Chama no WhatsApp e confira a oferta de hoje.",
    template: "combo",
  },
  {
    name: "Cashback",
    headline: "Seu pedido pode render cashback",
    subtitle: "Compre, acumule e use seu saldo em novos pedidos.",
    badge: "CASHBACK",
    cta: "Aproveite",
    caption: "Aqui seu pedido vale mais. 💜 Aproveite o cashback e use seu saldo nas próximas compras.",
    template: "cashback",
  },
  {
    name: "Encomendas",
    headline: "Vai ter festa? Conte com a gente!",
    subtitle: "Faça sua encomenda com antecedência.",
    badge: "ENCOMENDAS",
    cta: "Solicite seu orçamento",
    caption: "Festa chegando? 🎉 Faça sua encomenda com antecedência e deixe os salgados com a gente.",
    template: "encomendas",
  },
  {
    name: "Última chamada",
    headline: "Ainda dá tempo de pedir",
    subtitle: "Garanta seu pedido antes de encerrarmos por hoje.",
    badge: "ÚLTIMA CHAMADA",
    cta: "Peça agora",
    caption: "Última chamada de hoje! ⏰ Ainda dá tempo de garantir seu pedido.",
    template: "oferta",
  },
]

function localDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function emptyDraft(storeName: string): Draft {
  return {
    title: "Publicação do dia",
    channel: "instagram_story",
    caption: `Confira as novidades da ${storeName}! 😋`,
    cta: "Faça seu pedido",
    scheduledDate: localDateString(),
    scheduledTime: "09:00",
    recurrence: "none",
    recurrenceDays: [1, 2, 3, 4, 5, 6],
    recurrenceTime: "09:00",
    status: "scheduled",
    mediaUrl: "",
    flyer: {
      template: "oferta",
      headline: "Oferta do dia",
      subtitle: "Sabor que combina com o seu dia.",
      price: "",
      badge: "OFERTA",
      cta: "Peça agora",
      background: "#111827",
      accent: "#f97316",
      text: "#ffffff",
      photoDataUrl: "",
    },
  }
}

function channelLabel(channel: Channel) {
  if (channel === "instagram_feed") return "Instagram Feed"
  if (channel === "instagram_story") return "Instagram Story"
  return "WhatsApp Status"
}

function statusLabel(status: PublicationStatus) {
  return {
    draft: "Rascunho",
    ready: "Pronta",
    scheduled: "Agendada",
    published: "Publicada",
    cancelled: "Cancelada",
    failed: "Falhou",
  }[status]
}

function dimensions(channel: Channel) {
  return channel === "instagram_feed"
    ? { width: 1080, height: 1080 }
    : { width: 1080, height: 1920 }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4,
) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  let line = ""
  let lineIndex = 0
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight)
      line = word
      lineIndex += 1
      if (lineIndex >= maxLines - 1) break
    } else {
      line = candidate
    }
  }
  if (line && lineIndex < maxLines) {
    ctx.fillText(line, x, y + lineIndex * lineHeight)
  }
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function flyerBlob(channel: Channel, flyer: FlyerDraft) {
  const { width, height } = dimensions(channel)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Seu navegador não conseguiu gerar a arte.")

  ctx.fillStyle = flyer.background
  ctx.fillRect(0, 0, width, height)

  if (flyer.photoDataUrl) {
    try {
      const image = await loadImage(flyer.photoDataUrl)
      const photoHeight = Math.round(height * 0.48)
      const ratio = Math.max(width / image.width, photoHeight / image.height)
      const drawWidth = image.width * ratio
      const drawHeight = image.height * ratio
      ctx.drawImage(
        image,
        (width - drawWidth) / 2,
        (photoHeight - drawHeight) / 2,
        drawWidth,
        drawHeight,
      )
      const gradient = ctx.createLinearGradient(0, photoHeight * 0.3, 0, photoHeight)
      gradient.addColorStop(0, "rgba(0,0,0,0)")
      gradient.addColorStop(1, flyer.background)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, photoHeight + 40)
    } catch {
      // Mantém a arte mesmo se a foto local falhar.
    }
  }

  const top = flyer.photoDataUrl ? Math.round(height * 0.45) : Math.round(height * 0.14)
  const margin = 86

  ctx.fillStyle = flyer.accent
  ctx.font = "900 34px Arial"
  const badge = flyer.badge.trim().toUpperCase().slice(0, 28)
  if (badge) {
    const badgeWidth = Math.min(width - margin * 2, ctx.measureText(badge).width + 64)
    ctx.fillRect(margin, top, badgeWidth, 64)
    ctx.fillStyle = flyer.background
    ctx.fillText(badge, margin + 30, top + 43)
  }

  ctx.fillStyle = flyer.text
  ctx.font = `900 ${channel === "instagram_feed" ? 82 : 92}px Arial`
  wrapText(ctx, flyer.headline || "Oferta do dia", margin, top + 150, width - margin * 2, 104, 4)

  ctx.font = `600 ${channel === "instagram_feed" ? 38 : 44}px Arial`
  ctx.globalAlpha = 0.88
  wrapText(ctx, flyer.subtitle || "", margin, top + (channel === "instagram_feed" ? 430 : 520), width - margin * 2, 58, 4)
  ctx.globalAlpha = 1

  if (flyer.price.trim()) {
    ctx.fillStyle = flyer.accent
    ctx.font = `900 ${channel === "instagram_feed" ? 92 : 110}px Arial`
    ctx.fillText(flyer.price.trim().slice(0, 24), margin, height - (channel === "instagram_feed" ? 170 : 300))
  }

  ctx.fillStyle = flyer.accent
  ctx.font = "900 38px Arial"
  ctx.fillText((flyer.cta || "Peça agora").slice(0, 44), margin, height - 90)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Não foi possível gerar o PNG."))
    }, "image/png", 0.95)
  })
}

export function MarketingPublicationsPanel({ settings }: { settings: StoreSettings }) {
  const [ready, setReady] = useState(true)
  const [publications, setPublications] = useState<Publication[]>([])
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(settings.storeName))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const template = useMemo(
    () => templates.find((item) => item.key === draft.flyer.template) || templates[0],
    [draft.flyer.template],
  )

  useEffect(() => {
    fetch("/api/marketing-publications", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Erro ao carregar publicações.")
        setReady(data.ready !== false)
        setPublications(Array.isArray(data.publications) ? data.publications : [])
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Erro ao carregar publicações."))
  }, [])

  function applyTemplate(key: string) {
    const found = templates.find((item) => item.key === key) || templates[0]
    setDraft((current) => ({
      ...current,
      flyer: {
        ...current.flyer,
        template: found.key,
        background: found.background,
        accent: found.accent,
        text: found.text,
      },
    }))
  }

  function applyReadyPost(post: (typeof readyPosts)[number]) {
    applyTemplate(post.template)
    setDraft((current) => ({
      ...current,
      title: post.name,
      caption: post.caption.replace("${store}", settings.storeName),
      cta: post.cta,
      flyer: {
        ...current.flyer,
        template: post.template,
        headline: post.headline,
        subtitle: post.subtitle,
        badge: post.badge,
        cta: post.cta,
        ...(templates.find((item) => item.key === post.template) || templates[0]),
      },
    }))
    setMessage(`Modelo “${post.name}” carregado.`)
  }

  function photoChanged(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setMessage("Selecione uma imagem válida.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage("A imagem deve ter no máximo 8 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setDraft((current) => ({
        ...current,
        flyer: { ...current.flyer, photoDataUrl: String(reader.result || "") },
      }))
    }
    reader.readAsDataURL(file)
  }

  async function uploadFlyer() {
    setBusy(true)
    setMessage("Gerando flyer...")
    try {
      const blob = await flyerBlob(draft.channel, draft.flyer)
      const form = new FormData()
      form.set("file", new File([blob], "flyer.png", { type: "image/png" }))
      const response = await fetch("/api/marketing-publications/assets", {
        method: "POST",
        body: form,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao enviar o flyer.")
      setDraft((current) => ({ ...current, mediaUrl: data.mediaUrl }))
      setMessage("Flyer gerado e anexado à publicação.")
      return data.mediaUrl as string
    } catch (error) {
      const text = error instanceof Error ? error.message : "Erro ao gerar flyer."
      setMessage(text)
      throw error
    } finally {
      setBusy(false)
    }
  }

  async function downloadCurrentFlyer() {
    setBusy(true)
    try {
      const blob = await flyerBlob(draft.channel, draft.flyer)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `saborflow-${draft.channel}-${Date.now()}.png`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 2_000)
      setMessage("Flyer baixado em PNG.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao baixar flyer.")
    } finally {
      setBusy(false)
    }
  }

  function scheduledIso() {
    if (!draft.scheduledDate || !draft.scheduledTime) return undefined
    const date = new Date(`${draft.scheduledDate}T${draft.scheduledTime}:00`)
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
  }

  async function savePublication() {
    setBusy(true)
    setMessage(editingId ? "Atualizando publicação..." : "Salvando publicação...")
    try {
      let mediaUrl = draft.mediaUrl
      if (!mediaUrl) {
        mediaUrl = await uploadFlyer()
      }

      const payload = {
        title: draft.title,
        channel: draft.channel,
        contentType: "flyer",
        caption: draft.caption,
        cta: draft.cta,
        mediaUrl,
        templateKey: draft.flyer.template,
        flyerPayload: {
          headline: draft.flyer.headline,
          subtitle: draft.flyer.subtitle,
          price: draft.flyer.price,
          badge: draft.flyer.badge,
          cta: draft.flyer.cta,
          background: draft.flyer.background,
          accent: draft.flyer.accent,
          text: draft.flyer.text,
        },
        scheduledAt: scheduledIso(),
        recurrence: draft.recurrence,
        recurrenceDays: draft.recurrence === "weekly" ? draft.recurrenceDays : [],
        recurrenceTime: draft.recurrence === "none" ? undefined : draft.recurrenceTime,
        status: draft.status,
        active: true,
      }

      const response = await fetch(
        editingId ? `/api/marketing-publications/${editingId}` : "/api/marketing-publications",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao salvar publicação.")
      const publication = data.publication as Publication
      setPublications((current) => editingId
        ? current.map((item) => item.id === publication.id ? publication : item)
        : [publication, ...current])
      setEditingId(null)
      setDraft(emptyDraft(settings.storeName))
      setMessage("Publicação salva com sucesso.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar publicação.")
    } finally {
      setBusy(false)
    }
  }

  async function patchPublication(id: string, patch: Record<string, unknown>) {
    setBusy(true)
    try {
      const response = await fetch(`/api/marketing-publications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar publicação.")
      setPublications((current) => current.map((item) => item.id === id ? data.publication : item))
      return data.publication as Publication
    } finally {
      setBusy(false)
    }
  }

  function editPublication(item: Publication) {
    const flyer = item.flyerPayload || {}
    const scheduled = item.scheduledAt ? new Date(item.scheduledAt) : null
    const localDate = scheduled && Number.isFinite(scheduled.getTime())
      ? new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
      : ""
    setEditingId(item.id)
    setDraft({
      title: item.title,
      channel: item.channel,
      caption: item.caption,
      cta: item.cta,
      scheduledDate: localDate.slice(0, 10) || localDateString(),
      scheduledTime: localDate.slice(11, 16) || "09:00",
      recurrence: item.recurrence,
      recurrenceDays: item.recurrenceDays,
      recurrenceTime: item.recurrenceTime || "09:00",
      status: item.status,
      mediaUrl: item.mediaUrl || "",
      flyer: {
        template: item.templateKey || "oferta",
        headline: String(flyer.headline || item.title),
        subtitle: String(flyer.subtitle || ""),
        price: String(flyer.price || ""),
        badge: String(flyer.badge || "OFERTA"),
        cta: String(flyer.cta || item.cta || "Peça agora"),
        background: String(flyer.background || template?.background || "#111827"),
        accent: String(flyer.accent || template?.accent || "#f97316"),
        text: String(flyer.text || "#ffffff"),
        photoDataUrl: "",
      },
    })
    setMessage("Publicação carregada para edição.")
  }

  function toggleDay(day: number) {
    setDraft((current) => ({
      ...current,
      recurrenceDays: current.recurrenceDays.includes(day)
        ? current.recurrenceDays.filter((value) => value !== day)
        : [...current.recurrenceDays, day].sort((a, b) => a - b),
    }))
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-700 p-2 text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">Etapa 12</p>
            <h2 className="mt-1 text-lg font-black text-gray-950">Publicações programadas + flyers</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              Monte artes para Instagram e Status do WhatsApp, deixe posts prontos e organize recorrência diária ou semanal.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          O SaborFlow prepara e agenda a fila. O envio automático depende da conexão oficial do canal.
        </div>
      </div>

      {!ready && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          A migration da Etapa 12 ainda precisa ser aplicada no PostgreSQL.
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-700" />
          <h3 className="font-black text-gray-950">Posts prontos</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {readyPosts.map((post) => (
            <button
              key={post.name}
              type="button"
              onClick={() => applyReadyPost(post)}
              className="rounded-xl border border-gray-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
            >
              <strong className="block text-sm text-gray-950">{post.name}</strong>
              <span className="mt-1 block text-xs text-gray-500">{post.headline}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">Nome interno</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                placeholder="Ex.: Post de terça-feira"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">Canal</span>
              <select
                value={draft.channel}
                onChange={(event) => setDraft({ ...draft, channel: event.target.value as Channel, mediaUrl: "" })}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="instagram_feed">Instagram Feed</option>
                <option value="instagram_story">Instagram Story</option>
                <option value="whatsapp_status">WhatsApp Status</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-violet-700" />
              <h3 className="font-black text-gray-950">Criador de flyer</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {templates.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => applyTemplate(item.key)}
                  className={`rounded-xl border p-3 text-left text-xs font-black ${draft.flyer.template === item.key ? "border-violet-400 bg-violet-50 text-violet-800" : "border-gray-200 bg-white text-gray-600"}`}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={draft.flyer.headline}
                onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, headline: event.target.value }, mediaUrl: "" })}
                placeholder="Título principal"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              />
              <input
                value={draft.flyer.badge}
                onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, badge: event.target.value }, mediaUrl: "" })}
                placeholder="Selo: OFERTA, HOJE..."
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              />
              <input
                value={draft.flyer.subtitle}
                onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, subtitle: event.target.value }, mediaUrl: "" })}
                placeholder="Subtítulo"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm md:col-span-2"
              />
              <input
                value={draft.flyer.price}
                onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, price: event.target.value }, mediaUrl: "" })}
                placeholder="Preço: R$ 29,90"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              />
              <input
                value={draft.flyer.cta}
                onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, cta: event.target.value }, cta: event.target.value, mediaUrl: "" })}
                placeholder="Chamada: Peça agora"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-gray-600">
                Fundo
                <input type="color" value={draft.flyer.background} onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, background: event.target.value }, mediaUrl: "" })} className="mt-1 h-10 w-full rounded-lg" />
              </label>
              <label className="text-xs font-bold text-gray-600">
                Destaque
                <input type="color" value={draft.flyer.accent} onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, accent: event.target.value }, mediaUrl: "" })} className="mt-1 h-10 w-full rounded-lg" />
              </label>
              <label className="text-xs font-bold text-gray-600">
                Texto
                <input type="color" value={draft.flyer.text} onChange={(event) => setDraft({ ...draft, flyer: { ...draft.flyer, text: event.target.value }, mediaUrl: "" })} className="mt-1 h-10 w-full rounded-lg" />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700">
                <ImagePlus className="h-4 w-4" />
                Foto do produto
                <input type="file" accept="image/*" onChange={photoChanged} className="hidden" />
              </label>
              <button type="button" disabled={busy} onClick={uploadFlyer} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                <Sparkles className="h-4 w-4" />
                Gerar e anexar PNG
              </button>
              <button type="button" disabled={busy} onClick={downloadCurrentFlyer} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-50">
                <Download className="h-4 w-4" />
                Baixar flyer
              </button>
            </div>
          </div>

          <label>
            <span className="mb-1 block text-xs font-black uppercase text-gray-500">Legenda</span>
            <textarea
              value={draft.caption}
              onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
              rows={4}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm"
              placeholder="Legenda que acompanha a postagem"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">Data</span>
              <input type="date" value={draft.scheduledDate} onChange={(event) => setDraft({ ...draft, scheduledDate: event.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">Hora</span>
              <input type="time" value={draft.scheduledTime} onChange={(event) => setDraft({ ...draft, scheduledTime: event.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">Repetição</span>
              <select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value as Recurrence })} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
                <option value="none">Uma vez</option>
                <option value="daily">Todos os dias</option>
                <option value="weekly">Dias da semana</option>
              </select>
            </label>
          </div>

          {draft.recurrence !== "none" && (
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Repeat2 className="h-4 w-4 text-violet-700" />
                <strong className="text-sm">Recorrência</strong>
                <input type="time" value={draft.recurrenceTime} onChange={(event) => setDraft({ ...draft, recurrenceTime: event.target.value })} className="ml-auto h-9 rounded-lg border border-gray-200 px-2 text-sm" />
              </div>
              {draft.recurrence === "weekly" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {dayOptions.map(([day, label]) => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-lg border px-3 py-2 text-xs font-black ${draft.recurrenceDays.includes(day) ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500"}`}>
                      {draft.recurrenceDays.includes(day) ? "✓ " : ""}{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !ready} onClick={savePublication} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {busy ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar publicação"}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft(settings.storeName)); }} className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-600">
                Cancelar edição
              </button>
            )}
          </div>

          {message && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">{message}</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-950">
            <div className="p-3 text-xs font-black uppercase tracking-[0.14em] text-white/70">Prévia rápida</div>
            {draft.mediaUrl ? (
              <img src={draft.mediaUrl} alt="Prévia do flyer" className={`w-full object-cover ${draft.channel === "instagram_feed" ? "aspect-square" : "aspect-[9/16]"}`} />
            ) : (
              <div className={`flex flex-col justify-end p-8 ${draft.channel === "instagram_feed" ? "aspect-square" : "aspect-[9/16]"}`} style={{ background: draft.flyer.background, color: draft.flyer.text }}>
                <span className="mb-3 w-fit rounded-md px-3 py-1 text-xs font-black" style={{ background: draft.flyer.accent, color: draft.flyer.background }}>{draft.flyer.badge || "OFERTA"}</span>
                <h4 className="text-3xl font-black leading-tight">{draft.flyer.headline}</h4>
                <p className="mt-3 text-sm opacity-80">{draft.flyer.subtitle}</p>
                {draft.flyer.price && <strong className="mt-5 text-3xl" style={{ color: draft.flyer.accent }}>{draft.flyer.price}</strong>}
                <strong className="mt-5 text-sm" style={{ color: draft.flyer.accent }}>{draft.flyer.cta}</strong>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-violet-700" />
                <h3 className="font-black">Fila de publicações</h3>
              </div>
              <span className="text-xs font-bold text-gray-400">{publications.length}</span>
            </div>

            <div className="mt-3 max-h-[820px] space-y-2 overflow-auto pr-1">
              {!publications.length && (
                <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">Nenhuma publicação cadastrada.</div>
              )}
              {publications.map((item) => (
                <article key={item.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
                      {item.channel === "whatsapp_status" ? <MessageCircle className="h-4 w-4" /> : <Instagram className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-gray-950">{item.title}</strong>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : item.active ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-500"}`}>{statusLabel(item.status)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{channelLabel(item.channel)}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("pt-BR") : "Sem horário"}
                        {item.recurrence !== "none" ? ` · ${item.recurrence === "daily" ? "todo dia" : "semanal"} ${item.recurrenceTime || ""}` : ""}
                      </p>
                    </div>
                  </div>

                  {item.mediaUrl && <img src={item.mediaUrl} alt="Arte" className="mt-3 max-h-48 w-full rounded-lg object-cover" />}
                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-gray-600">{item.caption}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => editPublication(item)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600">Editar</button>
                    <button type="button" onClick={() => navigator.clipboard.writeText(item.caption)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600"><Copy className="h-3 w-3" /> Legenda</button>
                    {item.mediaUrl && <a href={item.mediaUrl} download className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600"><Download className="h-3 w-3" /> Arte</a>}
                    {item.status !== "published" && (
                      <button type="button" disabled={busy} onClick={() => patchPublication(item.id, { status: "published", publishedAt: new Date().toISOString() }).then(() => setMessage("Publicação marcada como publicada."))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white disabled:opacity-50"><Check className="h-3 w-3" /> Publicada</button>
                    )}
                    <button type="button" disabled={busy} onClick={() => patchPublication(item.id, { active: !item.active }).then(() => setMessage(item.active ? "Publicação pausada." : "Publicação reativada."))} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600 disabled:opacity-50">{item.active ? "Pausar" : "Ativar"}</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
