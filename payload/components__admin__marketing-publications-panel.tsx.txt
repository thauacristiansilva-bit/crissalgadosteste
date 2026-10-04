"use client"

import { useEffect, useState } from "react"
import {
  CalendarDays,
  Clock3,
  Copy,
  Download,
  ImagePlus,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Repeat2,
  Save,
  Upload,
} from "lucide-react"
import type { StoreSettings } from "@/lib/types"
import { MetaInstagramConnectionCard } from "@/components/admin/meta-instagram-connection-card"

type Channel =
  | "instagram_feed"
  | "instagram_story"
  | "whatsapp_status"

type Recurrence =
  | "none"
  | "daily"
  | "weekly"

type PublicationStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "published"
  | "cancelled"
  | "failed"

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
  lastError?: string
  createdAt: string
  updatedAt: string
}

type Draft = {
  title: string
  channel: Channel
  caption: string
  scheduledDate: string
  scheduledTime: string
  recurrence: Recurrence
  recurrenceDays: number[]
  recurrenceTime: string
  mediaUrl: string
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

const MAX_INPUT_BYTES = 15 * 1024 * 1024

function localDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10)
}

function emptyDraft(storeName: string): Draft {
  return {
    title: "Publicação do dia",
    channel: "instagram_story",
    caption: `Confira as novidades da ${storeName}! 😋`,
    scheduledDate: localDateString(),
    scheduledTime: "09:00",
    recurrence: "none",
    recurrenceDays: [1, 2, 3, 4, 5, 6],
    recurrenceTime: "09:00",
    mediaUrl: "",
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

function targetForChannel(channel: Channel) {
  if (channel === "instagram_feed") {
    return {
      width: 1080,
      height: 1080,
      ratio: 1,
      label: "1:1",
      example: "1080 × 1080 px",
    }
  }

  return {
    width: 1080,
    height: 1920,
    ratio: 9 / 16,
    label: "9:16",
    example: "1080 × 1920 px",
  }
}

async function imageFromFile(file: File) {
  const url = URL.createObjectURL(file)

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("Não foi possível ler essa imagem."))
      image.src = url
    })
  } finally {
    // Revogado depois que a imagem já foi decodificada pelo navegador.
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }
}

async function normalizeArtwork(file: File, channel: Channel) {
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ])

  if (!allowed.has(file.type)) {
    throw new Error("Use uma arte em JPG, PNG ou WEBP.")
  }

  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error("A arte deve ter no máximo 15 MB.")
  }

  const image = await imageFromFile(file)
  const target = targetForChannel(channel)

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("A imagem enviada não possui dimensões válidas.")
  }

  const ratio = image.naturalWidth / image.naturalHeight
  const difference = Math.abs(ratio - target.ratio) / target.ratio

  if (difference > 0.025) {
    throw new Error(
      `${channelLabel(channel)} precisa estar no formato ${target.label}. ` +
      `Use ${target.example}. Sua imagem é ${image.naturalWidth} × ${image.naturalHeight} px.`,
    )
  }

  const canvas = document.createElement("canvas")
  canvas.width = target.width
  canvas.height = target.height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Seu navegador não conseguiu preparar a imagem.")
  }

  // Evita transparência incompatível ao converter PNG/WEBP para JPEG.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.drawImage(image, 0, 0, target.width, target.height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value)
        else reject(new Error("Não foi possível converter a arte para JPG."))
      },
      "image/jpeg",
      0.94,
    )
  })

  return new File(
    [blob],
    `publicacao-${channel}-${Date.now()}.jpg`,
    { type: "image/jpeg" },
  )
}

export function MarketingPublicationsPanel({
  settings,
}: {
  settings: StoreSettings
}) {
  const [ready, setReady] = useState(true)
  const [publications, setPublications] = useState<Publication[]>([])
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(settings.storeName))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  async function loadPublications() {
    try {
      const response = await fetch("/api/marketing-publications", {
        cache: "no-store",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao carregar publicações.")
      }

      setReady(data.ready !== false)
      setPublications(
        Array.isArray(data.publications)
          ? data.publications
          : [],
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao carregar publicações.",
      )
    }
  }

  useEffect(() => {
    void loadPublications()
  }, [])

  async function uploadArtwork(file: File) {
    setBusy(true)
    setMessage("Validando e enviando a arte...")

    try {
      const normalized = await normalizeArtwork(file, draft.channel)
      const form = new FormData()
      form.set("file", normalized)

      const response = await fetch(
        "/api/marketing-publications/assets",
        {
          method: "POST",
          body: form,
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar a arte.")
      }

      setDraft((current) => ({
        ...current,
        mediaUrl: String(data.mediaUrl || ""),
      }))

      setMessage(
        `Arte pronta para ${channelLabel(draft.channel)} em ` +
        `${targetForChannel(draft.channel).example}.`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao enviar a arte.",
      )
    } finally {
      setBusy(false)
    }
  }

  function artworkChanged(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return
    void uploadArtwork(file)
  }

  function scheduledIso() {
    if (!draft.scheduledDate || !draft.scheduledTime) {
      return undefined
    }

    const date = new Date(
      `${draft.scheduledDate}T${draft.scheduledTime}:00`,
    )

    return Number.isFinite(date.getTime())
      ? date.toISOString()
      : undefined
  }

  async function savePublication() {
    if (!draft.mediaUrl) {
      setMessage("Anexe a arte pronta antes de agendar.")
      return
    }

    const scheduledAt = scheduledIso()

    if (!scheduledAt) {
      setMessage("Informe uma data e um horário válidos.")
      return
    }

    setBusy(true)
    setMessage(
      editingId
        ? "Atualizando agendamento..."
        : "Salvando agendamento...",
    )

    try {
      const payload = {
        title: draft.title,
        channel: draft.channel,
        contentType: "image",
        caption: draft.caption,
        cta: "",
        mediaUrl: draft.mediaUrl,
        templateKey: "",
        flyerPayload: {
          format: targetForChannel(draft.channel).label,
          width: targetForChannel(draft.channel).width,
          height: targetForChannel(draft.channel).height,
          source: "uploaded_artwork",
        },
        scheduledAt,
        recurrence: draft.recurrence,
        recurrenceDays:
          draft.recurrence === "weekly"
            ? draft.recurrenceDays
            : [],
        recurrenceTime:
          draft.recurrence === "none"
            ? undefined
            : draft.recurrenceTime,
        // Instagram só vira published após confirmação da API.
        status: "scheduled",
        active: true,
      }

      const response = await fetch(
        editingId
          ? `/api/marketing-publications/${editingId}`
          : "/api/marketing-publications",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar publicação.")
      }

      const publication = data.publication as Publication

      setPublications((current) =>
        editingId
          ? current.map((item) =>
              item.id === publication.id
                ? publication
                : item,
            )
          : [publication, ...current],
      )

      setEditingId(null)
      setDraft(emptyDraft(settings.storeName))
      setMessage("Publicação agendada com sucesso.")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar publicação.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function patchPublication(
    id: string,
    patch: Record<string, unknown>,
  ) {
    setBusy(true)

    try {
      const response = await fetch(
        `/api/marketing-publications/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patch),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || "Erro ao atualizar publicação.",
        )
      }

      setPublications((current) =>
        current.map((item) =>
          item.id === id
            ? data.publication
            : item,
        ),
      )

      return data.publication as Publication
    } finally {
      setBusy(false)
    }
  }

  function editPublication(item: Publication) {
    const scheduled =
      item.scheduledAt
        ? new Date(item.scheduledAt)
        : null

    const localDate =
      scheduled &&
      Number.isFinite(scheduled.getTime())
        ? new Date(
            scheduled.getTime() -
            scheduled.getTimezoneOffset() * 60_000,
          )
            .toISOString()
            .slice(0, 16)
        : ""

    setEditingId(item.id)
    setDraft({
      title: item.title,
      channel: item.channel,
      caption: item.caption,
      scheduledDate:
        localDate.slice(0, 10) ||
        localDateString(),
      scheduledTime:
        localDate.slice(11, 16) ||
        "09:00",
      recurrence: item.recurrence,
      recurrenceDays:
        item.recurrenceDays || [],
      recurrenceTime:
        item.recurrenceTime || "09:00",
      mediaUrl:
        item.mediaUrl || "",
    })

    setMessage(
      item.status === "published"
        ? "Publicação carregada. Ao salvar novamente, ela será reagendada."
        : "Publicação carregada para edição.",
    )
  }

  function toggleDay(day: number) {
    setDraft((current) => ({
      ...current,
      recurrenceDays:
        current.recurrenceDays.includes(day)
          ? current.recurrenceDays.filter(
              (value) => value !== day,
            )
          : [...current.recurrenceDays, day]
              .sort((a, b) => a - b),
    }))
  }

  const target = targetForChannel(draft.channel)

  return (
    <div className="space-y-5">
      <MetaInstagramConnectionCard />

      <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-700 p-2 text-white">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">
                Publicações
              </p>

              <h2 className="mt-1 text-lg font-black text-gray-950">
                Agendar artes prontas
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
                Crie sua arte no Canva, IA, Google Flow ou onde preferir.
                Aqui você apenas anexa a imagem pronta, escolhe o canal e programa o horário.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">
            Feed: 1:1 · Story e WhatsApp: 9:16
          </div>
        </div>

        {!ready && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            A migration da área de publicações ainda precisa ser aplicada no PostgreSQL.
          </div>
        )}

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                  Nome interno
                </span>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      title: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  placeholder="Ex.: Promoção de sábado"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                  Onde publicar
                </span>
                <select
                  value={draft.channel}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      channel: event.target.value as Channel,
                      mediaUrl: "",
                    })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="instagram_feed">
                    Instagram Feed · 1:1
                  </option>
                  <option value="instagram_story">
                    Instagram Story · 9:16
                  </option>
                  <option value="whatsapp_status">
                    WhatsApp Status · 9:16
                  </option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-gray-950">
                    Arte pronta
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Formato exigido: <strong>{target.label}</strong> · recomendado{" "}
                    <strong>{target.example}</strong>. JPG, PNG ou WEBP.
                    O Sabor Flow converte automaticamente para JPG antes de enviar.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white">
                  <Upload className="h-4 w-4" />
                  {busy ? "Enviando..." : draft.mediaUrl ? "Trocar arte" : "Anexar arte"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={artworkChanged}
                    disabled={busy}
                    className="hidden"
                  />
                </label>
              </div>

              {draft.mediaUrl ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <ImagePlus className="h-4 w-4" />
                    Arte anexada e validada
                  </div>

                  <div
                    className={`mx-auto overflow-hidden rounded-xl border border-gray-200 bg-white ${
                      draft.channel === "instagram_feed"
                        ? "max-w-sm aspect-square"
                        : "max-w-[260px] aspect-[9/16]"
                    }`}
                  >
                    <img
                      src={draft.mediaUrl}
                      alt="Prévia da arte"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div
                  className={`mt-4 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white text-center ${
                    draft.channel === "instagram_feed"
                      ? "aspect-square max-w-sm"
                      : "aspect-[9/16] max-w-[260px]"
                  }`}
                >
                  <div className="p-5">
                    <ImagePlus className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-xs font-bold text-gray-400">
                      Anexe uma arte {target.label}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Legenda
              </span>
              <textarea
                value={draft.caption}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    caption: event.target.value,
                  })
                }
                rows={4}
                className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                placeholder="Legenda que acompanha a postagem"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                  Data
                </span>
                <input
                  type="date"
                  value={draft.scheduledDate}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      scheduledDate: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                  Hora
                </span>
                <input
                  type="time"
                  value={draft.scheduledTime}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      scheduledTime: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                  Repetição
                </span>
                <select
                  value={draft.recurrence}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      recurrence: event.target.value as Recurrence,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="none">
                    Uma vez
                  </option>
                  <option value="daily">
                    Todos os dias
                  </option>
                  <option value="weekly">
                    Dias da semana
                  </option>
                </select>
              </label>
            </div>

            {draft.recurrence !== "none" && (
              <div className="rounded-xl border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Repeat2 className="h-4 w-4 text-violet-700" />
                  <strong className="text-sm">
                    Recorrência
                  </strong>

                  <input
                    type="time"
                    value={draft.recurrenceTime}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        recurrenceTime: event.target.value,
                      })
                    }
                    className="ml-auto h-9 rounded-lg border border-gray-200 px-2 text-sm"
                  />
                </div>

                {draft.recurrence === "weekly" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dayOptions.map(([day, label]) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`rounded-lg border px-3 py-2 text-xs font-black ${
                          draft.recurrenceDays.includes(day)
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-gray-200 text-gray-500"
                        }`}
                      >
                        {draft.recurrenceDays.includes(day) ? "✓ " : ""}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !ready || !draft.mediaUrl}
                onClick={savePublication}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {editingId ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {busy
                  ? "Salvando..."
                  : editingId
                    ? "Salvar e reagendar"
                    : "Agendar publicação"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setDraft(emptyDraft(settings.storeName))
                  }}
                  className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-600"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            {message && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">
                {message}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-violet-700" />
                <h3 className="font-black">
                  Fila de publicações
                </h3>
              </div>

              <span className="text-xs font-bold text-gray-400">
                {publications.length}
              </span>
            </div>

            <div className="mt-3 max-h-[950px] space-y-2 overflow-auto pr-1">
              {!publications.length && (
                <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
                  Nenhuma publicação cadastrada.
                </div>
              )}

              {publications.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
                      {item.channel === "whatsapp_status" ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-gray-950">
                          {item.title}
                        </strong>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-black ${
                            item.status === "published"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.status === "failed"
                                ? "bg-red-50 text-red-700"
                                : item.active
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {channelLabel(item.channel)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {item.scheduledAt
                          ? new Date(item.scheduledAt).toLocaleString("pt-BR")
                          : "Sem horário"}
                        {item.recurrence !== "none"
                          ? ` · ${
                              item.recurrence === "daily"
                                ? "todo dia"
                                : "semanal"
                            } ${item.recurrenceTime || ""}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {item.mediaUrl && (
                    <div
                      className={`mt-3 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 ${
                        item.channel === "instagram_feed"
                          ? "aspect-square"
                          : "aspect-[9/16] max-h-80"
                      }`}
                    >
                      <img
                        src={item.mediaUrl}
                        alt="Arte"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  {item.caption && (
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-gray-600">
                      {item.caption}
                    </p>
                  )}

                  {item.lastError && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                      {item.lastError}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => editPublication(item)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(item.caption || "")
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600"
                    >
                      <Copy className="h-3 w-3" />
                      Legenda
                    </button>

                    {item.mediaUrl && (
                      <a
                        href={item.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600"
                      >
                        <Download className="h-3 w-3" />
                        Arte
                      </a>
                    )}

                    {item.channel === "whatsapp_status" &&
                      item.status !== "published" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patchPublication(item.id, {
                              status: "published",
                              publishedAt: new Date().toISOString(),
                            }).then(() =>
                              setMessage(
                                "Status do WhatsApp marcado como publicado.",
                              ),
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                        >
                          <Play className="h-3 w-3" />
                          Marcar publicada
                        </button>
                      )}

                    {item.status !== "published" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          patchPublication(item.id, {
                            active: !item.active,
                          }).then(() =>
                            setMessage(
                              item.active
                                ? "Publicação pausada."
                                : "Publicação reativada.",
                            ),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600 disabled:opacity-50"
                      >
                        {item.active ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {item.active ? "Pausar" : "Ativar"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
