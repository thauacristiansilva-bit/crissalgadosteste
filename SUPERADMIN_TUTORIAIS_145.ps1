$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.5 - GERENCIADOR DE TUTORIAIS NO SUPERADMIN ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

$dashboardFile = "components\superadmin\superadmin-dashboard.tsx"
$dbFile = "lib\help-center-admin-db.ts"
$storageFile = "lib\storage\help-center-media.ts"
$apiFile = "app\api\superadmin\help-center\route.ts"
$videoApiFile = "app\api\superadmin\help-center\video\route.ts"
$panelFile = "components\superadmin\help-center-admin-panel.tsx"
$migrationFile = "database\migrations\038_help_center_admin_permissions.sql"

if (-not (Test-Path $dashboardFile)) {
  throw "Arquivo nao encontrado: $dashboardFile"
}

$migration = @'
-- Etapa 14.5
-- Permissoes do backend autenticado do Superadmin para gerenciar tutoriais.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'saborflow_rls_app'
  ) THEN
    GRANT SELECT
      ON TABLE sf_help_categories
      TO saborflow_rls_app;

    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE sf_help_articles
      TO saborflow_rls_app;
  END IF;
END
$$;
'@

[System.IO.File]::WriteAllText(
  $migrationFile,
  $migration,
  [System.Text.UTF8Encoding]::new($false)
)

$db = @'
import { randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"

export type HelpCenterAdminCategory = {
  id: string
  slug: string
  name: string
  description: string
  sortOrder: number
}

export type HelpCenterAdminArticle = {
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

type CategoryRow = {
  id: string
  slug: string
  name: string
  description: string | null
  sort_order: number
}

type ArticleRow = {
  id: string
  slug: string
  feature_key: string | null
  title: string
  summary: string
  content: string
  keywords: string[] | null
  audience: "admin" | "customer" | "all"
  video_url: string | null
  video_storage_key: string | null
  video_thumbnail_url: string | null
  video_duration_seconds: number | null
  published: boolean
  sort_order: number
  category_slug: string | null
  category_name: string | null
  created_at: Date | string
  updated_at: Date | string
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max)
}

function cleanKeywords(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .slice(0, 30)
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
}

function rowToArticle(row: ArticleRow): HelpCenterAdminArticle {
  return {
    id: row.id,
    slug: row.slug,
    featureKey: row.feature_key,
    title: row.title,
    summary: row.summary || "",
    content: row.content || "",
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    audience: row.audience,
    videoUrl: row.video_url,
    videoStorageKey: row.video_storage_key,
    videoThumbnailUrl: row.video_thumbnail_url,
    videoDurationSeconds: row.video_duration_seconds,
    published: row.published,
    sortOrder: row.sort_order,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export async function getHelpCenterAdminData() {
  const pool = getPostgresPool()

  const [categoriesResult, articlesResult] = await Promise.all([
    pool.query<CategoryRow>(
      `
        SELECT id, slug, name, description, sort_order
        FROM sf_help_categories
        WHERE active = true
        ORDER BY sort_order ASC, name ASC
      `,
    ),
    pool.query<ArticleRow>(
      `
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
          article.video_storage_key,
          article.video_thumbnail_url,
          article.video_duration_seconds,
          article.published,
          article.sort_order,
          category.slug AS category_slug,
          category.name AS category_name,
          article.created_at,
          article.updated_at
        FROM sf_help_articles article
        LEFT JOIN sf_help_categories category
          ON category.id = article.category_id
        ORDER BY
          article.published DESC,
          article.sort_order ASC,
          article.updated_at DESC
      `,
    ),
  ])

  return {
    categories: categoriesResult.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description || "",
      sortOrder: row.sort_order,
    })),
    articles: articlesResult.rows.map(rowToArticle),
  }
}

export async function saveHelpCenterAdminArticle(input: Record<string, unknown>) {
  const pool = getPostgresPool()

  const id = cleanText(input.id, 80)
  const title = cleanText(input.title, 180)
  const categorySlug = cleanText(input.categorySlug, 100)

  if (!title) throw new Error("Informe o título do tutorial.")
  if (!categorySlug) throw new Error("Selecione uma categoria.")

  const categoryResult = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM sf_help_categories
      WHERE slug = $1 AND active = true
      LIMIT 1
    `,
    [categorySlug],
  )

  const categoryId = categoryResult.rows[0]?.id
  if (!categoryId) throw new Error("Categoria de ajuda inválida.")

  const audienceRaw = cleanText(input.audience, 20)
  const audience: "admin" | "customer" | "all" =
    audienceRaw === "customer" || audienceRaw === "all"
      ? audienceRaw
      : "admin"

  const sortOrder = Number.isFinite(Number(input.sortOrder))
    ? Math.max(0, Math.floor(Number(input.sortOrder)))
    : 0

  const duration =
    input.videoDurationSeconds === null ||
    typeof input.videoDurationSeconds === "undefined" ||
    input.videoDurationSeconds === ""
      ? null
      : Math.max(0, Math.floor(Number(input.videoDurationSeconds) || 0))

  let slug = slugify(title) || `tutorial-${randomUUID().slice(0, 8)}`

  const conflict = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM sf_help_articles
      WHERE slug = $1
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
    `,
    [slug, id || null],
  )

  if (conflict.rows[0]) slug = `${slug}-${randomUUID().slice(0, 8)}`

  const params = [
    categoryId,
    slug,
    cleanText(input.featureKey, 100) || null,
    title,
    cleanText(input.summary, 1200),
    cleanText(input.content, 12000),
    cleanKeywords(input.keywords),
    audience,
    cleanText(input.videoUrl, 1200) || null,
    cleanText(input.videoStorageKey, 600) || null,
    cleanText(input.videoThumbnailUrl, 1200) || null,
    duration,
    input.published === true,
    sortOrder,
  ]

  if (id) {
    const result = await pool.query<ArticleRow>(
      `
        UPDATE sf_help_articles
        SET
          category_id = $2,
          slug = $3,
          feature_key = $4,
          title = $5,
          summary = $6,
          content = $7,
          keywords = $8::text[],
          audience = $9,
          video_url = $10,
          video_storage_key = $11,
          video_thumbnail_url = $12,
          video_duration_seconds = $13,
          published = $14,
          sort_order = $15,
          updated_at = now()
        WHERE id = $1::uuid
        RETURNING
          id, slug, feature_key, title, summary, content, keywords,
          audience, video_url, video_storage_key, video_thumbnail_url,
          video_duration_seconds, published, sort_order, created_at, updated_at,
          NULL::text AS category_slug,
          NULL::text AS category_name
      `,
      [id, ...params],
    )
    if (!result.rows[0]) throw new Error("Tutorial não encontrado.")
    return rowToArticle(result.rows[0])
  }

  const result = await pool.query<ArticleRow>(
    `
      INSERT INTO sf_help_articles (
        category_id, slug, feature_key, title, summary, content, keywords,
        audience, video_url, video_storage_key, video_thumbnail_url,
        video_duration_seconds, published, sort_order
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::text[],
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING
        id, slug, feature_key, title, summary, content, keywords,
        audience, video_url, video_storage_key, video_thumbnail_url,
        video_duration_seconds, published, sort_order, created_at, updated_at,
        NULL::text AS category_slug,
        NULL::text AS category_name
    `,
    params,
  )

  return result.rows[0] ? rowToArticle(result.rows[0]) : null
}

export async function deleteHelpCenterAdminArticle(id: string) {
  const cleanId = cleanText(id, 80)
  if (!cleanId) return false

  const result = await getPostgresPool().query(
    `DELETE FROM sf_help_articles WHERE id = $1::uuid`,
    [cleanId],
  )

  return (result.rowCount || 0) > 0
}
'@

[System.IO.File]::WriteAllText(
  $dbFile,
  $db,
  [System.Text.UTF8Encoding]::new($false)
)

$storage = @'
import { randomUUID } from "node:crypto"
import { getR2Config, putR2Object } from "@/lib/storage/r2"

const MAX_HELP_VIDEO_BYTES = 150 * 1024 * 1024

const allowedVideoTypes = {
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const

type AllowedVideoType = keyof typeof allowedVideoTypes

function isAllowedVideoType(value: string): value is AllowedVideoType {
  return Object.prototype.hasOwnProperty.call(allowedVideoTypes, value)
}

function looksLikeMp4(bytes: Uint8Array) {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp"
  )
}

function looksLikeWebm(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
}

export async function storeHelpCenterVideo(file: File) {
  if (!getR2Config()) throw new Error("Cloudflare R2 não está configurado.")

  if (!isAllowedVideoType(file.type)) {
    throw new Error("Formato de vídeo inválido. Use MP4 ou WebM.")
  }

  if (file.size <= 0 || file.size > MAX_HELP_VIDEO_BYTES) {
    throw new Error("O vídeo deve ter no máximo 150 MB.")
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  const signatureOk =
    file.type === "video/mp4" ? looksLikeMp4(bytes) : looksLikeWebm(bytes)

  if (!signatureOk) {
    throw new Error(
      "O conteúdo do arquivo não corresponde ao formato de vídeo informado.",
    )
  }

  const extension = allowedVideoTypes[file.type]
  const key = `help-center/videos/tutorial-${Date.now()}-${randomUUID()}.${extension}`
  const url = await putR2Object(key, bytes, file.type)

  return {
    url,
    key,
    size: file.size,
    contentType: file.type,
  }
}
'@

[System.IO.File]::WriteAllText(
  $storageFile,
  $storage,
  [System.Text.UTF8Encoding]::new($false)
)

New-Item -ItemType Directory -Force -Path (Split-Path $apiFile) | Out-Null

$api = @'
import { NextResponse } from "next/server"
import {
  deleteHelpCenterAdminArticle,
  getHelpCenterAdminData,
  saveHelpCenterAdminArticle,
} from "@/lib/help-center-admin-db"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { getSuperadminAccess } from "@/lib/superadmin-auth"

export const dynamic = "force-dynamic"

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

function canWrite(role: string) {
  return role === "owner"
}

export async function GET() {
  const access = await getSuperadminAccess()
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: headers() },
    )
  }

  try {
    return NextResponse.json(
      {
        ok: true,
        data: await getHelpCenterAdminData(),
        canWrite: canWrite(access.role),
      },
      { headers: headers() },
    )
  } catch (error) {
    console.error("Falha ao carregar tutoriais do Superadmin.", error)
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar os tutoriais." },
      { status: 500, headers: headers() },
    )
  }
}

export async function POST(request: Request) {
  const access = await getSuperadminAccess()

  if (!access || !canWrite(access.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Apenas o Superadmin proprietário pode alterar tutoriais.",
      },
      { status: access ? 403 : 401, headers: headers() },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da requisição recusada." },
      { status: 403, headers: headers() },
    )
  }

  let body: Record<string, unknown> | null = null
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = null
  }

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos." },
      { status: 400, headers: headers() },
    )
  }

  try {
    return NextResponse.json(
      { ok: true, article: await saveHelpCenterAdminArticle(body) },
      { headers: headers() },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o tutorial.",
      },
      { status: 400, headers: headers() },
    )
  }
}

export async function DELETE(request: Request) {
  const access = await getSuperadminAccess()

  if (!access || !canWrite(access.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Apenas o Superadmin proprietário pode excluir tutoriais.",
      },
      { status: access ? 403 : 401, headers: headers() },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da requisição recusada." },
      { status: 403, headers: headers() },
    )
  }

  let id = ""
  try {
    const body = (await request.json()) as { id?: unknown }
    id = String(body.id || "").trim()
  } catch {
    id = ""
  }

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Tutorial inválido." },
      { status: 400, headers: headers() },
    )
  }

  const deleted = await deleteHelpCenterAdminArticle(id)

  return NextResponse.json(
    {
      ok: deleted,
      error: deleted ? undefined : "Tutorial não encontrado.",
    },
    { status: deleted ? 200 : 404, headers: headers() },
  )
}
'@

[System.IO.File]::WriteAllText(
  $apiFile,
  $api,
  [System.Text.UTF8Encoding]::new($false)
)

New-Item -ItemType Directory -Force -Path (Split-Path $videoApiFile) | Out-Null

$videoApi = @'
import { NextResponse } from "next/server"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { storeHelpCenterVideo } from "@/lib/storage/help-center-media"
import { getSuperadminAccess } from "@/lib/superadmin-auth"

export const dynamic = "force-dynamic"

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

export async function POST(request: Request) {
  const access = await getSuperadminAccess()

  if (!access || access.role !== "owner") {
    return NextResponse.json(
      {
        ok: false,
        error: "Apenas o Superadmin proprietário pode enviar vídeos.",
      },
      { status: access ? 403 : 401, headers: headers() },
    )
  }

  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origem da requisição recusada." },
      { status: 403, headers: headers() },
    )
  }

  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Selecione um vídeo." },
        { status: 400, headers: headers() },
      )
    }

    return NextResponse.json(
      { ok: true, video: await storeHelpCenterVideo(file) },
      { headers: headers() },
    )
  } catch (error) {
    console.error("Falha no upload de vídeo da Central de Ajuda.", error)
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o vídeo.",
      },
      { status: 400, headers: headers() },
    )
  }
}
'@

[System.IO.File]::WriteAllText(
  $videoApiFile,
  $videoApi,
  [System.Text.UTF8Encoding]::new($false)
)

$panel = @'
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

    const payload = new FormData()
    payload.append("file", videoFile)

    const response = await fetch("/api/superadmin/help-center/video", {
      method: "POST",
      body: payload,
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
'@

[System.IO.File]::WriteAllText(
  $panelFile,
  $panel,
  [System.Text.UTF8Encoding]::new($false)
)

$dashboard = [System.IO.File]::ReadAllText($dashboardFile)

if ($dashboard -notmatch '@/components/superadmin/help-center-admin-panel') {
  $anchor = 'import type { PlatformFinanceSnapshot } from "@/lib/platform-finance"'
  if (-not $dashboard.Contains($anchor)) {
    throw "Nao encontrei o ponto de importacao do Superadmin."
  }
  $dashboard = $dashboard.Replace(
    $anchor,
    $anchor + "`r`n" +
      'import { HelpCenterAdminPanel } from "@/components/superadmin/help-center-admin-panel"'
  )
}

if ($dashboard -notmatch '"Tutoriais"') {
  $dashboard = $dashboard.Replace(
    '  "Domínios",' + "`r`n" + '  "Suporte",',
    '  "Domínios",' + "`r`n" + '  "Tutoriais",' + "`r`n" + '  "Suporte",'
  )

  $dashboard = $dashboard.Replace(
    '{ label: "Operação", items: ["Domínios", "Suporte"] },',
    '{ label: "Operação", items: ["Domínios", "Tutoriais", "Suporte"] },'
  )

  $dashboard = $dashboard.Replace(
    '  "Domínios": "Domínios das empresas e situação de verificação.",' + "`r`n" +
      '  "Suporte": "Chamados das empresas e acompanhamento de atendimento.",',
    '  "Domínios": "Domínios das empresas e situação de verificação.",' + "`r`n" +
      '  "Tutoriais": "Central de Ajuda, documentação e vídeos de treinamento do SaborFlow.",' + "`r`n" +
      '  "Suporte": "Chamados das empresas e acompanhamento de atendimento.",'
  )
}

if ($dashboard -notmatch 'tab === "Tutoriais"') {
  $anchor = '{tab === "Suporte" &&'
  $index = $dashboard.IndexOf($anchor)
  if ($index -lt 0) {
    throw "Nao encontrei o render da aba Suporte."
  }
  $lineStart = $dashboard.LastIndexOf("`n", $index) + 1
  $dashboard = $dashboard.Insert(
    $lineStart,
    '        {tab === "Tutoriais" && <HelpCenterAdminPanel />}' + "`r`n`r`n"
  )
}

[System.IO.File]::WriteAllText(
  $dashboardFile,
  $dashboard,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Arquivos criados/atualizados."
Write-Host ""

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
Write-Host "ETAPA 14.5 - SUPERADMIN TUTORIAIS - BUILD OK"
Write-Host ""
