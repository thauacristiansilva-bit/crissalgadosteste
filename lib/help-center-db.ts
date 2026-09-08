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
          rank DESC,
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