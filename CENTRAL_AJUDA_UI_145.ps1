$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.5 - CENTRAL DE AJUDA VISUAL ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$helpDbFile = "lib\help-center-db.ts"
$apiFile = "app\api\admin\help-center\route.ts"
$panelFile = "components\admin\help-center-panel.tsx"
$accessFile = "lib\admin-access.ts"
$dashboardFile = "components\admin\admin-dashboard.tsx"

foreach ($file in @($helpDbFile, $accessFile, $dashboardFile)) {
  if (-not (Test-Path $file)) {
    throw "Arquivo nao encontrado: $file"
  }
}

# -------------------------------------------------------------------
# 1) Camada de banco da Central de Ajuda
# -------------------------------------------------------------------

$helpDb = @'
import { getPostgresPool } from "@/lib/postgres"

export type HelpCenterAudience =
  | "admin"
  | "customer"
  | "all"

export type HelpCenterCategory = {
  slug: string
  name: string
  description: string
  articleCount: number
}

export type HelpCenterSearchResult = {
  id: string
  slug: string
  featureKey: string | null
  title: string
  summary: string
  content: string
  keywords: string[]
  audience: HelpCenterAudience
  videoUrl: string | null
  videoThumbnailUrl: string | null
  videoDurationSeconds: number | null
  categorySlug: string | null
  categoryName: string | null
  rank: number
}

type HelpCenterSearchRow = {
  id: string
  slug: string
  feature_key: string | null
  title: string
  summary: string
  content: string
  keywords: string[] | null
  audience: HelpCenterAudience
  video_url: string | null
  video_thumbnail_url: string | null
  video_duration_seconds: number | null
  category_slug: string | null
  category_name: string | null
  rank: string | number | null
}

type HelpCenterCategoryRow = {
  slug: string
  name: string
  description: string | null
  article_count: string | number
}

function safeLimit(
  value: number | undefined,
  fallback = 3,
  maximum = 50,
) {
  if (
    !Number.isFinite(value) ||
    !value
  ) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(
      1,
      Math.floor(value),
    ),
  )
}

function cleanQuestion(
  value: string,
) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 500)
}

function rowToResult(
  row: HelpCenterSearchRow,
): HelpCenterSearchResult {
  const rank = Number(row.rank)

  return {
    id: row.id,
    slug: row.slug,
    featureKey:
      row.feature_key,
    title: row.title,
    summary:
      row.summary || "",
    content:
      row.content || "",
    keywords:
      Array.isArray(row.keywords)
        ? row.keywords
        : [],
    audience: row.audience,
    videoUrl:
      row.video_url,
    videoThumbnailUrl:
      row.video_thumbnail_url,
    videoDurationSeconds:
      row.video_duration_seconds,
    categorySlug:
      row.category_slug,
    categoryName:
      row.category_name,
    rank:
      Number.isFinite(rank)
        ? rank
        : 0,
  }
}

export async function listHelpCenterCategories(
  audience: Exclude<
    HelpCenterAudience,
    "all"
  > = "admin",
): Promise<HelpCenterCategory[]> {
  const pool =
    getPostgresPool()

  const result =
    await pool.query<HelpCenterCategoryRow>(
      `
        SELECT
          category.slug,
          category.name,
          category.description,
          count(article.id)
            FILTER (
              WHERE
                article.published = true
                AND (
                  article.audience = $1
                  OR article.audience = 'all'
                )
            ) AS article_count
        FROM sf_help_categories
          AS category
        LEFT JOIN sf_help_articles
          AS article
          ON article.category_id =
            category.id
        WHERE category.active = true
        GROUP BY
          category.id,
          category.slug,
          category.name,
          category.description,
          category.sort_order
        ORDER BY
          category.sort_order ASC,
          category.name ASC
      `,
      [audience],
    )

  return result.rows.map(
    (row) => ({
      slug: row.slug,
      name: row.name,
      description:
        row.description || "",
      articleCount:
        Number(row.article_count) || 0,
    }),
  )
}

export async function listHelpCenterArticles(
  options?: {
    audience?: Exclude<
      HelpCenterAudience,
      "all"
    >
    query?: string
    categorySlug?: string
    limit?: number
  },
): Promise<HelpCenterSearchResult[]> {
  const audience =
    options?.audience ||
    "admin"

  const query =
    cleanQuestion(
      options?.query || "",
    )

  const categorySlug =
    (options?.categorySlug || "")
      .trim()
      .slice(0, 100)

  const limit =
    safeLimit(
      options?.limit,
      30,
      50,
    )

  const pool =
    getPostgresPool()

  const result =
    await pool.query<HelpCenterSearchRow>(
      `
        WITH search_input AS (
          SELECT
            CASE
              WHEN $1 = ''
                THEN NULL
              ELSE plainto_tsquery(
                'portuguese',
                $1
              )
            END AS query
        )
        SELECT
          article.id,
          article.slug,
          article.feature_key,
          article.title,
          article.summary,
          article.content,
          article.keywords,
          article.audience,
          article.video_url,
          article.video_thumbnail_url,
          article.video_duration_seconds,
          category.slug
            AS category_slug,
          category.name
            AS category_name,
          CASE
            WHEN $1 = ''
              THEN 0
            ELSE (
              ts_rank_cd(
                to_tsvector(
                  'portuguese',
                  coalesce(
                    article.title,
                    ''
                  ) || ' ' ||
                  coalesce(
                    article.summary,
                    ''
                  ) || ' ' ||
                  coalesce(
                    article.content,
                    ''
                  )
                ),
                search_input.query
              ) * 10
              +
              CASE
                WHEN article.title
                  ILIKE '%' || $1 || '%'
                  THEN 5
                ELSE 0
              END
              +
              CASE
                WHEN article.summary
                  ILIKE '%' || $1 || '%'
                  THEN 2
                ELSE 0
              END
            )
          END AS rank
        FROM sf_help_articles
          AS article
        CROSS JOIN search_input
        LEFT JOIN sf_help_categories
          AS category
          ON category.id =
            article.category_id
        WHERE
          article.published = true
          AND (
            article.audience = $2
            OR article.audience = 'all'
          )
          AND (
            $3 = ''
            OR category.slug = $3
          )
          AND (
            $1 = ''
            OR (
              to_tsvector(
                'portuguese',
                coalesce(
                  article.title,
                  ''
                ) || ' ' ||
                coalesce(
                  article.summary,
                  ''
                ) || ' ' ||
                coalesce(
                  article.content,
                  ''
                )
              )
              @@ search_input.query
              OR article.title
                ILIKE '%' || $1 || '%'
              OR article.summary
                ILIKE '%' || $1 || '%'
              OR EXISTS (
                SELECT 1
                FROM unnest(
                  article.keywords
                ) AS keyword
                WHERE keyword
                  ILIKE '%' || $1 || '%'
              )
            )
          )
        ORDER BY
          CASE
            WHEN $1 = ''
              THEN 0
            ELSE rank
          END DESC,
          article.sort_order ASC,
          article.title ASC
        LIMIT $4
      `,
      [
        query,
        audience,
        categorySlug,
        limit,
      ],
    )

  return result.rows.map(
    rowToResult,
  )
}

export async function searchHelpCenterArticles(
  question: string,
  options?: {
    audience?: Exclude<
      HelpCenterAudience,
      "all"
    >
    limit?: number
  },
): Promise<HelpCenterSearchResult[]> {
  return listHelpCenterArticles({
    audience:
      options?.audience ||
      "admin",
    query: question,
    limit:
      safeLimit(
        options?.limit,
        3,
        5,
      ),
  })
}

function compactText(
  value: string,
  maxChars: number,
) {
  const clean =
    value
      .trim()
      .replace(/\s+/g, " ")

  if (
    clean.length <=
    maxChars
  ) {
    return clean
  }

  return `${clean.slice(
    0,
    Math.max(
      0,
      maxChars - 1,
    ),
  )}…`
}

export function buildHelpCenterAiContext(
  articles: HelpCenterSearchResult[],
  maxChars = 3600,
) {
  if (!articles.length) {
    return ""
  }

  const sections: string[] = []
  let usedChars = 0

  for (
    const article
    of articles
  ) {
    const videoLine =
      article.videoUrl
        ? `Vídeo de ajuda: ${article.videoUrl}`
        : ""

    const block = [
      `TÍTULO: ${article.title}`,
      article.categoryName
        ? `CATEGORIA: ${article.categoryName}`
        : "",
      article.summary
        ? `RESUMO: ${compactText(
            article.summary,
            500,
          )}`
        : "",
      article.content
        ? `INSTRUÇÕES: ${compactText(
            article.content,
            1400,
          )}`
        : "",
      videoLine,
    ]
      .filter(Boolean)
      .join("\n")

    if (!block) {
      continue
    }

    const separator =
      sections.length
        ? "\n\n---\n\n"
        : ""

    const nextSize =
      usedChars +
      separator.length +
      block.length

    if (
      nextSize >
      maxChars
    ) {
      const remaining =
        maxChars -
        usedChars -
        separator.length

      if (
        remaining > 120
      ) {
        sections.push(
          compactText(
            block,
            remaining,
          ),
        )
      }

      break
    }

    sections.push(block)
    usedChars = nextSize
  }

  if (!sections.length) {
    return ""
  }

  return `
BASE DE CONHECIMENTO DA SABORFLOW
Use este conteúdo somente para responder dúvidas sobre como usar o SaborFlow.
Não invente etapas que não estejam documentadas aqui.
Quando houver vídeo, você pode indicar o vídeo ao usuário.

${sections.join(
  "\n\n---\n\n",
)}
  `.trim()
}
'@

[System.IO.File]::WriteAllText(
  $helpDbFile,
  $helpDb,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Atualizado: $helpDbFile"

# -------------------------------------------------------------------
# 2) API autenticada da Central de Ajuda
# -------------------------------------------------------------------

New-Item -ItemType Directory -Force -Path (Split-Path $apiFile) | Out-Null

$api = @'
import { NextResponse } from "next/server"
import {
  listHelpCenterArticles,
  listHelpCenterCategories,
} from "@/lib/help-center-db"
import { permissionListHas } from "@/lib/operational-permissions"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

export async function GET(
  request: Request,
) {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Não autorizado.",
      },
      {
        status: 401,
        headers: responseHeaders(),
      },
    )
  }

  if (
    !permissionListHas(
      session.operationalPermissions,
      "dashboard.view",
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Seu perfil não pode acessar a Central de Ajuda.",
      },
      {
        status: 403,
        headers: responseHeaders(),
      },
    )
  }

  const url =
    new URL(request.url)

  const query =
    (url.searchParams.get("q") || "")
      .trim()
      .slice(0, 500)

  const category =
    (url.searchParams.get("category") || "")
      .trim()
      .slice(0, 100)

  try {
    const [
      categories,
      articles,
    ] = await Promise.all([
      listHelpCenterCategories(
        "admin",
      ),
      listHelpCenterArticles({
        audience: "admin",
        query,
        categorySlug:
          category,
        limit: 40,
      }),
    ])

    return NextResponse.json(
      {
        ok: true,
        query,
        category,
        categories,
        articles,
      },
      {
        headers:
          responseHeaders(),
      },
    )
  } catch (error) {
    console.error(
      "Falha ao carregar Central de Ajuda.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          "Não foi possível carregar a Central de Ajuda.",
      },
      {
        status: 500,
        headers: responseHeaders(),
      },
    )
  }
}
'@

[System.IO.File]::WriteAllText(
  $apiFile,
  $api,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Criado: $apiFile"

# -------------------------------------------------------------------
# 3) Painel visual
# -------------------------------------------------------------------

$panel = @'
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
'@

[System.IO.File]::WriteAllText(
  $panelFile,
  $panel,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Criado: $panelFile"

# -------------------------------------------------------------------
# 4) Adiciona secao HELP ao controle de acesso
# -------------------------------------------------------------------

$access = [System.IO.File]::ReadAllText($accessFile)

if ($access -notmatch '\|\s*"help"') {
  $old = '  | "settings"' + "`r`n" + '  | "security"'
  $new = '  | "settings"' + "`r`n" + '  | "help"' + "`r`n" + '  | "security"'

  if (-not $access.Contains($old)) {
    $old = '  | "settings"' + "`n" + '  | "security"'
    $new = '  | "settings"' + "`n" + '  | "help"' + "`n" + '  | "security"'
  }

  if (-not $access.Contains($old)) {
    throw "Nao encontrei o ponto de AdminSection para adicionar help."
  }

  $access = $access.Replace(
    $old,
    $new
  )
}

if ($access -notmatch '(?m)^\s*help:\s*"dashboard\.view"') {
  $old = '  settings: "settings.view",'
  $new = '  settings: "settings.view",' + "`r`n" + '  help: "dashboard.view",'

  if (-not $access.Contains($old)) {
    throw "Nao encontrei sectionPermission.settings."
  }

  $access = $access.Replace(
    $old,
    $new
  )
}

[System.IO.File]::WriteAllText(
  $accessFile,
  $access,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Atualizado: $accessFile"

# -------------------------------------------------------------------
# 5) Integra no menu e render do dashboard
# -------------------------------------------------------------------

$dashboard = [System.IO.File]::ReadAllText($dashboardFile)

if ($dashboard -notmatch '\bCircleHelp,') {
  $old = '  ClipboardList,'
  $new = '  ClipboardList,' + "`r`n" + '  CircleHelp,'

  if (-not $dashboard.Contains($old)) {
    throw "Nao encontrei ClipboardList no import lucide."
  }

  $dashboard = $dashboard.Replace(
    $old,
    $new
  )
}

if ($dashboard -notmatch '@/components/admin/help-center-panel') {
  $old = 'import { SecurityPanel } from "@/components/admin/security-panel"'
  $new = 'import { SecurityPanel } from "@/components/admin/security-panel"' + "`r`n" + 'import { HelpCenterPanel } from "@/components/admin/help-center-panel"'

  if (-not $dashboard.Contains($old)) {
    throw "Nao encontrei import SecurityPanel."
  }

  $dashboard = $dashboard.Replace(
    $old,
    $new
  )
}

if ($dashboard -notmatch 'key:\s*"help"') {
  $old = '  { key: "settings", label: "Configurações da loja", icon: Settings, group: "gestao" },'
  $new = $old + "`r`n" + '  { key: "help", label: "Central de Ajuda", icon: CircleHelp, group: "gestao" },'

  if (-not $dashboard.Contains($old)) {
    throw "Nao encontrei item Configuracoes da loja no menu."
  }

  $dashboard = $dashboard.Replace(
    $old,
    $new
  )
}

if ($dashboard -notmatch 'section === "help"') {
  $old = '          {section === "security" && <SecurityPanel canManageSecurity={permissionListHas(operationalPermissions, "security.manage")} />}'
  $new = '          {section === "help" && <HelpCenterPanel />}' + "`r`n" + $old

  if (-not $dashboard.Contains($old)) {
    throw "Nao encontrei render SecurityPanel."
  }

  $dashboard = $dashboard.Replace(
    $old,
    $new
  )
}

[System.IO.File]::WriteAllText(
  $dashboardFile,
  $dashboard,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Atualizado: $dashboardFile"
Write-Host ""

# -------------------------------------------------------------------
# 6) Validacao
# -------------------------------------------------------------------

git diff --check

if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

npm.cmd run typecheck

if ($LASTEXITCODE -ne 0) {
  throw "typecheck falhou."
}

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
  throw "build falhou."
}

git restore -- next-env.d.ts 2>$null

Write-Host ""
Write-Host "ETAPA 14.5 - CENTRAL DE AJUDA VISUAL - BUILD OK"
Write-Host ""
