"use client"

import {
  BookOpenText,
  CircleHelp,
  ExternalLink,
  PlayCircle,
  Search,
  Sparkles,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useState,
} from "react"

type HelpCategory = {
  slug: string
  name: string
  description: string
  articleCount: number
}

type HelpArticle = {
  id: string
  slug: string
  featureKey: string | null
  title: string
  summary: string
  content: string
  keywords: string[]
  audience: "admin" | "customer" | "all"
  videoUrl: string | null
  videoThumbnailUrl: string | null
  videoDurationSeconds: number | null
  categorySlug: string | null
  categoryName: string | null
}

type HelpResponse = {
  ok: boolean
  error?: string
  categories?: HelpCategory[]
  articles?: HelpArticle[]
}

function durationLabel(
  seconds: number | null,
) {
  if (
    !seconds ||
    seconds <= 0
  ) {
    return null
  }

  const minutes =
    Math.floor(seconds / 60)

  const rest =
    seconds % 60

  if (!minutes) {
    return `${rest}s`
  }

  return rest
    ? `${minutes}min ${rest}s`
    : `${minutes}min`
}

export function HelpCenterPanel() {
  const [query, setQuery] =
    useState("")
  const [category, setCategory] =
    useState("")
  const [categories, setCategories] =
    useState<HelpCategory[]>([])
  const [articles, setArticles] =
    useState<HelpArticle[]>([])
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState("")

  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError("")

          try {
            const params =
              new URLSearchParams()

            if (query.trim()) {
              params.set(
                "q",
                query.trim(),
              )
            }

            if (category) {
              params.set(
                "category",
                category,
              )
            }

            const suffix =
              params.toString()

            const response =
              await fetch(
                `/api/admin/help-center${
                  suffix
                    ? `?${suffix}`
                    : ""
                }`,
                {
                  method: "GET",
                  cache: "no-store",
                  signal:
                    controller.signal,
                },
              )

            const payload =
              (await response.json()
                .catch(() => null)) as
                | HelpResponse
                | null

            if (
              !response.ok ||
              !payload?.ok
            ) {
              throw new Error(
                payload?.error ||
                  "Não foi possível carregar a Central de Ajuda.",
              )
            }

            setCategories(
              payload.categories || [],
            )
            setArticles(
              payload.articles || [],
            )
          } catch (cause) {
            if (
              cause instanceof DOMException &&
              cause.name === "AbortError"
            ) {
              return
            }

            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível carregar a Central de Ajuda.",
            )
          } finally {
            if (
              !controller.signal.aborted
            ) {
              setLoading(false)
            }
          }
        },
        250,
      )

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    query,
    category,
  ])

  const publishedCount =
    useMemo(
      () =>
        categories.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.articleCount,
          0,
        ),
      [categories],
    )

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-orange-700">
                <CircleHelp className="h-4 w-4" />
                Central de Ajuda
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                Aprenda a usar o SaborFlow
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                Pesquise uma dúvida, consulte o passo a passo e assista aos vídeos de treinamento disponíveis.
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="font-black text-gray-950">
                {publishedCount} tutorial{publishedCount === 1 ? "" : "is"} publicado{publishedCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                A mesma base também ajuda a SaborFlow IA.
              </p>
            </div>
          </div>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Ex.: como cadastrar produto, como funciona a DRE..."
              className="h-14 w-full rounded-2xl border border-orange-200 bg-white pl-12 pr-4 text-sm font-semibold text-gray-900 outline-none transition placeholder:font-normal placeholder:text-gray-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() =>
              setCategory("")
            }
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
              !category
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-700"
            }`}
          >
            Todos
          </button>

          {categories.map(
            (item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() =>
                  setCategory(
                    item.slug,
                  )
                }
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                  category ===
                  item.slug
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-700"
                }`}
              >
                {item.name}
                {item.articleCount > 0
                  ? ` · ${item.articleCount}`
                  : ""}
              </button>
            ),
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="h-52 animate-pulse rounded-3xl border border-gray-200 bg-white"
              />
            ),
          )}
        </div>
      ) : articles.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {articles.map(
            (article) => {
              const duration =
                durationLabel(
                  article.videoDurationSeconds,
                )

              return (
                <article
                  key={article.id}
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
                >
                  {article.videoThumbnailUrl && (
                    <div className="aspect-video overflow-hidden border-b border-gray-100 bg-gray-100">
                      <img
                        src={
                          article.videoThumbnailUrl
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-orange-700">
                        {article.categoryName ||
                          "SaborFlow"}
                      </span>

                      {article.videoUrl && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-700">
                          <PlayCircle className="h-3.5 w-3.5" />
                          Vídeo
                          {duration
                            ? ` · ${duration}`
                            : ""}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-lg font-black text-gray-950">
                      {article.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {article.summary}
                    </p>

                    <details className="group mt-4 rounded-2xl border border-gray-200 bg-gray-50">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-black text-gray-800">
                        <BookOpenText className="h-4 w-4 text-orange-600" />
                        Ver passo a passo
                      </summary>

                      <div className="border-t border-gray-200 px-4 py-4 text-sm leading-7 text-gray-700 whitespace-pre-line">
                        {article.content}
                      </div>
                    </details>

                    {article.videoUrl ? (
                      <a
                        href={article.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white transition hover:bg-orange-600"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Assistir vídeo
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                        <Sparkles className="h-4 w-4" />
                        Tutorial em texto disponível
                      </div>
                    )}
                  </div>
                </article>
              )
            },
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-orange-300 bg-orange-50/50 p-8 text-center">
          <CircleHelp className="mx-auto h-8 w-8 text-orange-500" />
          <h3 className="mt-3 font-black text-gray-950">
            Nenhum tutorial encontrado
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Tente pesquisar com outras palavras ou escolha outra categoria.
          </p>
        </div>
      )}
    </div>
  )
}