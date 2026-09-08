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