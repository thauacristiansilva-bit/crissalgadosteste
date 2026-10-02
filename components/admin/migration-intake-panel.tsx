"use client"

import Link from "next/link"
import { ChangeEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  FileImage,
  Link2,
  LoaderCircle,
  MapPinned,
  PackageCheck,
  Save,
  Send,
  Sparkles,
  Store,
  Trash2,
  Truck,
  UploadCloud,
} from "lucide-react"
import { MIGRATION_MAX_ASSETS, MIGRATION_MAX_BATCH, type MigrationIntake } from "@/lib/migration-intake-types"

const inputClass = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
const textareaClass = `${inputClass} min-h-28 resize-y`

const systemOptions = [
  "Consumer",
  "Anota AI",
  "Saipos",
  "Goomer",
  "iFood / cardápio online",
  "WhatsApp / catálogo manual",
  "Planilha / arquivo próprio",
  "Outro sistema",
]

type Draft = Pick<MigrationIntake, "sourceSystem" | "sourceUrl" | "sourceNotes" | "deliveryNotes" | "locationNotes" | "catalogNotes" | "aiRequested">

function draftFrom(intake: MigrationIntake): Draft {
  return {
    sourceSystem: intake.sourceSystem,
    sourceUrl: intake.sourceUrl,
    sourceNotes: intake.sourceNotes,
    deliveryNotes: intake.deliveryNotes,
    locationNotes: intake.locationNotes,
    catalogNotes: intake.catalogNotes,
    aiRequested: intake.aiRequested,
  }
}

function statusLabel(status: MigrationIntake["status"]) {
  if (status === "submitted") return "Material enviado"
  if (status === "processing") return "Em preparação"
  if (status === "ready") return "Pronto para revisar"
  if (status === "completed") return "Migração concluída"
  return "Rascunho"
}

export function MigrationIntakePanel() {
  const [intake, setIntake] = useState<MigrationIntake | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/migration-intake", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a migração.")
      setIntake(payload.intake)
      setDraft(draftFrom(payload.intake))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a migração.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const editable = !intake || !["processing", "completed"].includes(intake.status)
  const materialCount = intake?.assets.length || 0
  const remaining = Math.max(0, MIGRATION_MAX_ASSETS - materialCount)
  const completion = useMemo(() => {
    if (!draft) return 0
    const checks = [
      Boolean(draft.sourceSystem || draft.sourceUrl),
      Boolean(materialCount || draft.sourceNotes || draft.catalogNotes),
      Boolean(draft.locationNotes || draft.deliveryNotes),
      Boolean(draft.catalogNotes || draft.sourceNotes),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [draft, materialCount])

  async function save(showMessage = true) {
    if (!draft || busy) return null
    setBusy(true)
    setError("")
    if (showMessage) setMessage("")
    try {
      const response = await fetch("/api/admin/migration-intake", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.")
      setIntake(payload.intake)
      setDraft(draftFrom(payload.intake))
      if (showMessage) setMessage("Rascunho salvo. Você pode continuar depois.")
      return payload.intake as MigrationIntake
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ""
    if (!files.length || uploading) return
    if (files.length > MIGRATION_MAX_BATCH) {
      setError(`Envie no máximo ${MIGRATION_MAX_BATCH} imagens por vez.`)
      return
    }
    if (files.length > remaining) {
      setError(`Esta migração aceita até ${MIGRATION_MAX_ASSETS} imagens. Restam ${remaining}.`)
      return
    }
    setUploading(true)
    setError("")
    setMessage("")
    try {
      for (const file of files) {
        const form = new FormData()
        form.append("file", file)
        const response = await fetch("/api/admin/migration-intake/upload", { method: "POST", body: form })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Não foi possível enviar ${file.name}.`)
        setIntake(payload.intake)
        setDraft(draftFrom(payload.intake))
      }
      setMessage(`${files.length} ${files.length === 1 ? "imagem enviada" : "imagens enviadas"}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar as imagens.")
    } finally {
      setUploading(false)
    }
  }

  async function removeAsset(assetId: string) {
    if (busy || uploading) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/admin/migration-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-asset", assetId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível remover o anexo.")
      setIntake(payload.intake)
      setDraft(draftFrom(payload.intake))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover o anexo.")
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!draft || busy || uploading) return
    const saved = await save(false)
    if (!saved) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/migration-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar a migração.")
      setIntake(payload.intake)
      setDraft(draftFrom(payload.intake))
      setMessage("Material recebido. Sua migração ficou registrada para preparação e revisão.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a migração.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 rounded-3xl border border-stone-200 bg-white text-sm font-bold text-stone-600"><LoaderCircle className="h-5 w-5 animate-spin" />Preparando sua migração...</div>
  }

  if (!draft || !intake) {
    return <div className="rounded-3xl border border-red-200 bg-white p-7"><p className="font-black text-red-800">Não foi possível abrir a área de migração.</p><p className="mt-2 text-sm text-red-700">{error || "Tente novamente."}</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black text-stone-500 hover:text-orange-700"><ArrowLeft className="h-4 w-4" />Voltar ao painel</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-stone-950 sm:text-3xl">Importar cadastro antigo</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${intake.status === "draft" ? "bg-stone-100 text-stone-600" : intake.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>{statusLabel(intake.status)}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Traga o máximo possível do que sua empresa já usa. Você não precisa recadastrar produto por produto antes de começar.</p>
        </div>
        <div className="min-w-44 rounded-2xl bg-[#fff8ee] p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">Preparação</p>
          <p className="mt-1 text-3xl font-black text-stone-950">{completion}%</p>
          <p className="text-xs font-bold text-stone-500">das informações principais</p>
        </div>
      </div>

      {(error || message) && <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}

      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Store className="h-5 w-5" /></div>
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">1. De onde você está vindo?</p><h2 className="mt-1 text-xl font-black text-stone-950">Informe o sistema ou cardápio antigo</h2></div>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-black text-stone-700">Sistema anterior
            <select disabled={!editable} className={inputClass} value={draft.sourceSystem} onChange={(event) => setDraft({ ...draft, sourceSystem: event.target.value })}>
              <option value="">Selecione, se souber</option>
              {systemOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-stone-700">Link antigo, se ainda estiver ativo
            <div className="relative"><Link2 className="absolute left-3 top-[22px] h-4 w-4 text-stone-400" /><input disabled={!editable} type="url" className={`${inputClass} pl-9`} placeholder="https://..." value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} /></div>
          </label>
        </div>
        <label className="mt-5 block text-sm font-black text-stone-700">O que é importante manter do sistema antigo?
          <textarea disabled={!editable} className={textareaClass} placeholder="Ex.: categorias, nomes dos produtos, preços, sabores, adicionais, combos, observações..." value={draft.sourceNotes} onChange={(event) => setDraft({ ...draft, sourceNotes: event.target.value })} />
        </label>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FileImage className="h-5 w-5" /></div>
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">2. Envie o que você já tem</p><h2 className="mt-1 text-xl font-black text-stone-950">Prints, fotos de cardápio e referências</h2><p className="mt-1 text-sm text-stone-500">Até {MIGRATION_MAX_ASSETS} imagens por migração e {MIGRATION_MAX_BATCH} por envio.</p></div>
        </div>
        {editable && remaining > 0 && (
          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-5 py-8 text-center hover:border-violet-300">
            {uploading ? <LoaderCircle className="h-8 w-8 animate-spin text-violet-600" /> : <UploadCloud className="h-8 w-8 text-violet-600" />}
            <span className="mt-3 text-sm font-black text-stone-900">{uploading ? "Enviando imagens..." : "Selecionar prints e fotos"}</span>
            <span className="mt-1 text-xs text-stone-500">JPG, PNG ou WEBP · máximo de 8 MB cada · restam {remaining}</span>
            <input disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={uploadFiles} />
          </label>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intake.assets.map((asset, index) => (
            <div key={asset.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><FileImage className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-stone-800">{index + 1}. {asset.filename}</p><p className="text-xs text-stone-500">{Math.max(1, Math.round(asset.size / 1024))} KB</p></div>
              {editable && <button type="button" onClick={() => void removeAsset(asset.id)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${asset.filename}`}><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><MapPinned className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">3. Localização</p><h2 className="mt-1 text-xl font-black">Como sua empresa atende hoje?</h2></div></div>
          <textarea disabled={!editable} className={textareaClass} placeholder="Ex.: endereço da loja, bairros atendidos, raio, taxa por região, referência, retirada no balcão..." value={draft.locationNotes} onChange={(event) => setDraft({ ...draft, locationNotes: event.target.value })} />
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Truck className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">4. Entrega e operação</p><h2 className="mt-1 text-xl font-black">Explique as regras que não podem ser perdidas</h2></div></div>
          <textarea disabled={!editable} className={textareaClass} placeholder="Ex.: entrega própria, motoboys, retirada, horários, pedido mínimo, tempo médio, taxas..." value={draft.deliveryNotes} onChange={(event) => setDraft({ ...draft, deliveryNotes: event.target.value })} />
        </section>
      </div>

      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><PackageCheck className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">5. Cardápio e valores</p><h2 className="mt-1 text-xl font-black">Conte o que precisa ficar exatamente igual</h2></div></div>
        <textarea disabled={!editable} className={textareaClass} placeholder="Ex.: produto X tem preço Y, combo exige 4 sabores, bebida é obrigatória, adicionais opcionais, cashback..." value={draft.catalogNotes} onChange={(event) => setDraft({ ...draft, catalogNotes: event.target.value })} />
        <label className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${draft.aiRequested ? "border-violet-300 bg-violet-50" : "border-stone-200 bg-stone-50"}`}>
          <input disabled={!editable} type="checkbox" className="mt-1 h-5 w-5 accent-violet-600" checked={draft.aiRequested} onChange={(event) => setDraft({ ...draft, aiRequested: event.target.checked })} />
          <span><span className="flex items-center gap-2 text-sm font-black text-stone-950"><Sparkles className="h-4 w-4 text-violet-600" />Quero usar IA para acelerar a preparação, se disponível no meu plano/adicional</span><span className="mt-1 block text-xs leading-5 text-stone-500">A IA pode ajudar a interpretar imagens e organizar a estrutura, mas tudo deve passar por revisão antes de publicar.</span></span>
        </label>
      </section>

      <section className="rounded-[28px] border-2 border-orange-200 bg-[#fffaf3] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Revisão e envio</p><h2 className="mt-2 text-2xl font-black text-stone-950">Você não precisa deixar tudo perfeito agora</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Envie o que tiver. Quanto mais material, melhor a preparação. O objetivo é evitar que você perca dias repetindo trabalho que já fez no sistema antigo.</p></div>
          {intake.status === "submitted" && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800"><Check className="h-4 w-4" />Material recebido</span>}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {editable && <button type="button" disabled={busy || uploading} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-black text-stone-800 hover:bg-stone-50 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar e continuar depois</button>}
          {editable && <button type="button" disabled={busy || uploading} onClick={() => void submit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar para preparação</button>}
          <Link href="/admin" className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-black text-white">Ir para o painel <ArrowLeft className="h-4 w-4 rotate-180" /></Link>
        </div>
      </section>
    </div>
  )
}
