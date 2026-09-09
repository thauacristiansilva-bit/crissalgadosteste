"use client"

import { Film, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type Category = {
  id: string
  slug: string
  name: string
  description: string
  sortOrder: number
}

type Article = {
  id: string
  slug: string
  featureKey: string | null
  title: string
  summary: string
  content: string
  keywords: string[]
  audience: "admin" | "customer" | "all"
  videoUrl: string | null
  videoStorageKey: string | null
  videoThumbnailUrl: string | null
  videoDurationSeconds: number | null
  published: boolean
  sortOrder: number
  categorySlug: string | null
  categoryName: string | null
  createdAt: string
  updatedAt: string
}

type Data = {
  categories: Category[]
  articles: Article[]
}

type FormState = {
  id: string
  categorySlug: string
  featureKey: string
  title: string
  summary: string
  content: string
  keywords: string
  audience: "admin" | "customer" | "all"
  videoUrl: string
  videoStorageKey: string
  videoDurationSeconds: string
  published: boolean
  sortOrder: string
}

const emptyForm: FormState = {
  id: "",
  categorySlug: "primeiros-passos",
  featureKey: "",
  title: "",
  summary: "",
  content: "",
  keywords: "",
  audience: "admin",
  videoUrl: "",
  videoStorageKey: "",
  videoDurationSeconds: "",
  published: false,
  sortOrder: "0",
}

export function HelpCenterAdminPanel() {
  const [data, setData] = useState<Data>({ categories: [], articles: [] })
  const [form, setForm] = useState<FormState>(emptyForm)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [canWrite, setCanWrite] = useState(false)
  const [search, setSearch] = useState("")

  async function refresh() {
    setBusy(true)
    setMessage("")

    try {
      const response = await fetch("/api/superadmin/help-center", {
        cache: "no-store",
      })
      const result = (await response.json()) as {
        ok?: boolean
        error?: string
        data?: Data
        canWrite?: boolean
      }

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.error || "Falha ao carregar tutoriais.")
      }

      setData(result.data)
      setCanWrite(result.canWrite === true)

      setForm((current) => ({
        ...current,
        categorySlug:
          current.categorySlug ||
          result.data?.categories[0]?.slug ||
          "primeiros-passos",
      }))
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao carregar tutoriais.",
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const visibleArticles = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data.articles

    return data.articles.filter((article) =>
      [
        article.title,
        article.summary,
        article.categoryName || "",
        article.keywords.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    )
  }, [data.articles, search])

  function resetForm() {
    setForm({
      ...emptyForm,
      categorySlug: data.categories[0]?.slug || "primeiros-passos",
    })
    setVideoFile(null)
  }

  function editArticle(article: Article) {
    setForm({
      id: article.id,
      categorySlug:
        article.categorySlug ||
        data.categories[0]?.slug ||
        "primeiros-passos",
      featureKey: article.featureKey || "",
      title: article.title,
      summary: article.summary,
      content: article.content,
      keywords: article.keywords.join(", "),
      audience: article.audience,
      videoUrl: article.videoUrl || "",
      videoStorageKey: article.videoStorageKey || "",
      videoDurationSeconds:
        article.videoDurationSeconds === null
          ? ""
          : String(article.videoDurationSeconds),
      published: article.published,
      sortOrder: String(article.sortOrder),
    })
    setVideoFile(null)
    setMessage("Editando tutorial.")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function uploadVideoIfNeeded() {
    if (!videoFile) {
      return {
        url: form.videoUrl || null,
        key: form.videoStorageKey || null,
      }
    }
const response = await fetch("/api/superadmin/help-center/video", {
      method: "POST",
      headers: {
            "Content-Type":
              videoFile.type,
          },
          body: videoFile,
    })

    const result = (await response.json()) as {
      ok?: boolean
      error?: string
      video?: { url: string; key: string }
    }

    if (!response.ok || !result.ok || !result.video) {
      throw new Error(result.error || "Falha ao enviar vídeo.")
    }

    return result.video
  }

  async function save() {
    if (!canWrite) return

    if (!form.title.trim()) {
      setMessage("Informe o título do tutorial.")
      return
    }

    setBusy(true)
    setMessage(
      videoFile
        ? "Enviando vídeo e salvando tutorial..."
        : "Salvando tutorial...",
    )

    try {
      const video = await uploadVideoIfNeeded()

      const response = await fetch("/api/superadmin/help-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          categorySlug: form.categorySlug,
          featureKey: form.featureKey,
          title: form.title,
          summary: form.summary,
          content: form.content,
          keywords: form.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          audience: form.audience,
          videoUrl: video.url,
          videoStorageKey: video.key,
          videoDurationSeconds: form.videoDurationSeconds || null,
          published: form.published,
          sortOrder: Number(form.sortOrder || 0),
        }),
      })

      const result = (await response.json()) as {
        ok?: boolean
        error?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Falha ao salvar tutorial.")
      }

      resetForm()
      await refresh()
      setMessage("Tutorial salvo com sucesso.")
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao salvar tutorial.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(article: Article) {
    if (
      !canWrite ||
      !window.confirm(`Excluir o tutorial "${article.title}"?`)
    ) {
      return
    }

    setBusy(true)
    setMessage("")

    try {
      const response = await fetch("/api/superadmin/help-center", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id }),
      })

      const result = (await response.json()) as {
        ok?: boolean
        error?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Falha ao excluir tutorial.")
      }

      if (form.id === article.id) resetForm()
      await refresh()
      setMessage("Tutorial excluído.")
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao excluir tutorial.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {message && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
          {message}
        </div>
      )}

      {canWrite && (
        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                {form.id ? "Editar tutorial" : "Novo tutorial"}
              </p>
              <h2 className="mt-1 text-xl font-black">
                Conteúdo da Central de Ajuda
              </h2>
            </div>

            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-stone-300"
              >
                <X className="h-4 w-4" />
                Cancelar edição
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="Título do tutorial"
              className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
            />

            <select
              value={form.categorySlug}
              onChange={(event) =>
                setForm({ ...form, categorySlug: event.target.value })
              }
              className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
            >
              {data.categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>

            <input
              value={form.featureKey}
              onChange={(event) =>
                setForm({ ...form, featureKey: event.target.value })
              }
              placeholder="Chave do recurso (ex.: produtos, dre, entrega)"
              className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
            />

            <input
              value={form.keywords}
              onChange={(event) =>
                setForm({ ...form, keywords: event.target.value })
              }
              placeholder="Palavras-chave separadas por vírgula"
              className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
            />

            <textarea
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
              placeholder="Resumo curto"
              className="min-h-24 rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm lg:col-span-2"
            />

            <textarea
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
              placeholder="Passo a passo completo do tutorial"
              className="min-h-44 rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm lg:col-span-2"
            />

            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-orange-400" />
                <p className="text-sm font-black">Vídeo do tutorial</p>
              </div>

              <p className="mt-1 text-xs text-stone-500">
                MP4 ou WebM, até 150 MB. O vídeo será salvo no Cloudflare R2.
              </p>

              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(event) =>
                  setVideoFile(event.target.files?.[0] || null)
                }
                className="mt-3 block w-full text-xs text-stone-300 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:font-black file:text-stone-950"
              />

              {videoFile && (
                <p className="mt-2 text-xs text-emerald-300">
                  Novo vídeo: {videoFile.name}
                </p>
              )}

              {!videoFile && form.videoUrl && (
                <a
                  href={form.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-xs font-black text-orange-300 underline"
                >
                  <Film className="h-4 w-4" />
                  Vídeo atual
                </a>
              )}
            </div>

            <select
              value={form.audience}
              onChange={(event) =>
                setForm({
                  ...form,
                  audience: event.target.value as FormState["audience"],
                })
              }
              className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
            >
              <option value="admin">Painel da empresa</option>
              <option value="customer">Cliente final</option>
              <option value="all">Todos</option>
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: event.target.value })
                }
                placeholder="Ordem"
                className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
              />

              <input
                type="number"
                min="0"
                value={form.videoDurationSeconds}
                onChange={(event) =>
                  setForm({
                    ...form,
                    videoDurationSeconds: event.target.value,
                  })
                }
                placeholder="Duração (s)"
                className="rounded-xl border border-white/10 bg-stone-900 px-3 py-3 text-sm"
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-stone-900 px-4 py-3 text-sm font-black lg:col-span-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) =>
                  setForm({ ...form, published: event.target.checked })
                }
                className="h-4 w-4 accent-orange-500"
              />
              Publicar tutorial para as empresas
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-stone-950 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {busy
                ? "Salvando..."
                : form.id
                  ? "Salvar alterações"
                  : "Criar tutorial"}
            </button>

            {!form.id && (
              <button
                type="button"
                disabled={busy}
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-stone-300"
              >
                <Plus className="h-4 w-4" />
                Limpar
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black">Tutoriais cadastrados</h2>
            <p className="mt-1 text-xs text-stone-500">
              {data.articles.length} conteúdo(s) na base de conhecimento.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar tutorial..."
            className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 space-y-3">
          {!busy && visibleArticles.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-stone-500">
              Nenhum tutorial encontrado.
            </p>
          )}

          {visibleArticles.map((article) => (
            <article
              key={article.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        article.published
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-stone-500/15 text-stone-400"
                      }`}
                    >
                      {article.published ? "Publicado" : "Rascunho"}
                    </span>

                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black text-stone-400">
                      {article.categoryName || "Sem categoria"}
                    </span>

                    {article.videoUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-[10px] font-black text-orange-300">
                        <Film className="h-3.5 w-3.5" />
                        Vídeo
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-black">{article.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
                    {article.summary || "Sem resumo."}
                  </p>
                </div>

                {canWrite && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => editArticle(article)}
                      className="rounded-lg border border-white/10 p-2 text-stone-300"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(article)}
                      className="rounded-lg border border-red-500/20 p-2 text-red-300"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {article.videoUrl && (
                <a
                  href={article.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-black text-orange-300 underline"
                >
                  <Film className="h-4 w-4" />
                  Abrir vídeo publicado
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}