const fs = require("fs")
const path = require("path")

const marketingFile = path.join("components", "admin", "marketing-panel.tsx")
const routeFile = path.join("app", "api", "promotions", "route.ts")
const itemRouteFile = path.join("app", "api", "promotions", "[id]", "route.ts")

for (const file of [marketingFile, routeFile, itemRouteFile]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${file}`)
  }
}

const marketing = fs.readFileSync(marketingFile, "utf8")

if (
  marketing.includes("promotionMessage") &&
  fs.readFileSync(routeFile, "utf8").includes("runWithTenantRlsScope") &&
  fs.readFileSync(itemRouteFile, "utf8").includes("runWithTenantRlsScope")
) {
  console.log("HOTFIX 14.8.3 ja esta aplicado.")
  process.exit(0)
}

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) {
    throw new Error(
      `${label}: esperado 1 trecho, encontrado(s) ${count}. Nenhum arquivo foi alterado.`
    )
  }
  return text.replace(oldText, newText)
}

let nextMarketing = marketing

// ------------------------------------------------------------
// 1) Mensagem especifica da promocao, visivel junto ao formulario
// ------------------------------------------------------------

nextMarketing = replaceOnce(
  nextMarketing,
`  const [promotionBusy, setPromotionBusy] =
    useState(false)

  const [editingPromotionId, setEditingPromotionId] =
`,
`  const [promotionBusy, setPromotionBusy] =
    useState(false)

  const [promotionMessage, setPromotionMessage] =
    useState("")

  const [editingPromotionId, setEditingPromotionId] =
`,
  "Criar estado promotionMessage"
)

const saveStart = nextMarketing.indexOf("  async function savePromotion(")
const toggleStart = nextMarketing.indexOf("  async function togglePromotion(")

if (saveStart < 0 || toggleStart < 0 || toggleStart <= saveStart) {
  throw new Error("Nao encontrei as funcoes de promocao. Nenhum arquivo foi alterado.")
}

const newSavePromotion = `  async function savePromotion(
    event: FormEvent,
  ) {
    event.preventDefault()

    if (
      !promotionDraft.productId
    ) {
      const text =
        "Selecione um produto."
      setPromotionMessage(text)
      setMessage(text)
      return
    }

    if (
      !promotionDraft
        .daysOfWeek.length
    ) {
      const text =
        "Selecione pelo menos um dia da semana."
      setPromotionMessage(text)
      setMessage(text)
      return
    }

    const promotionalPrice =
      Number(
        promotionDraft.promotionalPrice
          .replace(",", "."),
      )

    if (
      !Number.isFinite(
        promotionalPrice,
      ) ||
      promotionalPrice <= 0
    ) {
      const text =
        "Informe um preco promocional valido."
      setPromotionMessage(text)
      setMessage(text)
      return
    }

    setPromotionBusy(true)
    setPromotionMessage(
      "Salvando promocao...",
    )
    setMessage("")

    try {
      const editing =
        Boolean(
          editingPromotionId,
        )

      const response =
        await fetch(
          editing
            ? \`/api/promotions/\${editingPromotionId}\`
            : "/api/promotions",
          {
            method:
              editing
                ? "PATCH"
                : "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              ...promotionDraft,
              productId: Number(
                promotionDraft.productId,
              ),
              promotionalPrice,
            }),
          },
        )

      const responseText =
        await response.text()

      let data: {
        promotion?: ProductPromotion
        error?: string
      } = {}

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {}
      } catch {
        data = {
          error:
            responseText ||
            \`Erro HTTP \${response.status} ao salvar promocao.\`,
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            \`Erro HTTP \${response.status} ao salvar promocao.\`,
        )
      }

      if (!data.promotion) {
        throw new Error(
          "O servidor respondeu sem retornar a promocao criada.",
        )
      }

      const promotion =
        data.promotion

      setPromotions(
        (current) =>
          editing
            ? current.map(
                (item) =>
                  item.id ===
                  promotion.id
                    ? promotion
                    : item,
              )
            : [
                promotion,
                ...current,
              ],
      )

      resetPromotionForm()

      const successMessage =
        editing
          ? "Promocao atualizada com sucesso."
          : "Promocao criada com sucesso."

      setPromotionMessage(
        successMessage,
      )
      setMessage(
        successMessage,
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro ao salvar promocao."

      setPromotionMessage(
        errorMessage,
      )
      setMessage(
        errorMessage,
      )
    } finally {
      setPromotionBusy(false)
    }
  }

`

nextMarketing =
  nextMarketing.slice(0, saveStart) +
  newSavePromotion +
  nextMarketing.slice(toggleStart)

// Coloca feedback imediatamente abaixo do botao Criar promocao.
const buttonMarker = `            {promotionBusy
              ? "Salvando..."
              : editingPromotionId
                ? "Salvar alteracoes"
                : "Criar promoção"}
          </button>
        </form>
`

const buttonReplacement = `            {promotionBusy
              ? "Salvando..."
              : editingPromotionId
                ? "Salvar alteracoes"
                : "Criar promoção"}
          </button>

          {promotionMessage && (
            <div
              className={\`rounded-xl border px-4 py-3 text-sm font-bold \${
                /criada|atualizada|sucesso/i.test(
                  promotionMessage,
                )
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : promotionBusy
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-red-200 bg-red-50 text-red-700"
              }\`}
            >
              {promotionMessage}
            </div>
          )}
        </form>
`

nextMarketing = replaceOnce(
  nextMarketing,
  buttonMarker,
  buttonReplacement,
  "Adicionar feedback visivel ao formulario"
)

// ------------------------------------------------------------
// 2) Rotas de promocao com escopo RLS explicito.
// ------------------------------------------------------------

const routeContent = `import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getTenantProducts } from "@/lib/catalog-db"
import {
  createTenantProductPromotion,
  getTenantProductPromotions,
  isProductPromotionsReady,
  type ProductPromotionInput,
} from "@/lib/promotions-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

function inputFromBody(
  body: Record<string, unknown>,
): ProductPromotionInput {
  return {
    productId: Math.floor(
      Number(body.productId),
    ),
    promotionalPrice: Number(
      body.promotionalPrice,
    ),
    startDate:
      body.startDate
        ? String(body.startDate)
        : undefined,
    endDate:
      body.endDate
        ? String(body.endDate)
        : undefined,
    daysOfWeek:
      Array.isArray(body.daysOfWeek)
        ? body.daysOfWeek.map(Number)
        : [],
    startTime: String(
      body.startTime || "00:00",
    ),
    endTime: String(
      body.endTime || "23:59",
    ),
    recurringWeekly:
      body.recurringWeekly !== false,
    active: body.active !== false,
    highlight: body.highlight !== false,
    label: String(
      body.label || "Oferta",
    ),
  }
}

export async function GET() {
  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

  const session =
    await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sessao tenant obrigatoria.",
      },
      { status: 401 },
    )
  }

  if (
    !canManageMarketing(
      session.role,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Seu perfil nao pode visualizar promocoes.",
      },
      { status: 403 },
    )
  }

  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        const [
          ready,
          promotions,
          products,
        ] = await Promise.all([
          isProductPromotionsReady()
            .catch(() => false),
          getTenantProductPromotions(
            session.organizationId,
            { includeInactive: true },
          ),
          getTenantProducts(
            session.organizationId,
            { includeInactive: true },
          ),
        ])

        return NextResponse.json({
          ready,
          promotions,
          products: products.map(
            (product) => ({
              id: product.id,
              name: product.name,
              category:
                product.category,
              price: product.price,
              active: product.active,
            }),
          ),
        })
      },
      "tenant-session",
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar promocoes.",
      },
      { status: 400 },
    )
  }
}

export async function POST(
  request: Request,
) {
  if (
    !requestIsSameOrigin(request)
  ) {
    return NextResponse.json(
      {
        error:
          "Origem da requisicao nao permitida.",
      },
      { status: 403 },
    )
  }

  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

  try {
    const session =
      await getVerifiedTenantSession()

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Sessao tenant obrigatoria.",
        },
        { status: 401 },
      )
    }

    if (
      !canManageMarketing(
        session.role,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil nao pode gerenciar promocoes.",
        },
        { status: 403 },
      )
    }

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | Record<string, unknown>
        | null

    if (!body) {
      throw new Error(
        "Dados da promocao obrigatorios.",
      )
    }

    const promotion =
      await runWithTenantRlsScope(
        [session.organizationId],
        session.userId,
        () =>
          createTenantProductPromotion(
            session.organizationId,
            inputFromBody(body),
          ),
        "tenant-session",
      )

    if (!promotion) {
      throw new Error(
        "Nao foi possivel carregar a promocao criada.",
      )
    }

    const {
      invalidatePublicStoreCache,
    } = await import(
      "@/lib/public-store-db"
    )

    invalidatePublicStoreCache(
      session.organizationId,
    )

    return NextResponse.json(
      { promotion },
      { status: 201 },
    )
  } catch (error) {
    console.error(
      "[promotions:POST]",
      error,
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a promocao.",
      },
      { status: 400 },
    )
  }
}
`

const itemRouteContent = `import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import {
  updateTenantProductPromotion,
  type ProductPromotionInput,
} from "@/lib/promotions-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageMarketing } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { runWithTenantRlsScope } from "@/lib/rls-context"

export const dynamic = "force-dynamic"

function patchFromBody(
  body: Record<string, unknown>,
): Partial<ProductPromotionInput> {
  const patch: Partial<ProductPromotionInput> = {}

  if (body.productId !== undefined) {
    patch.productId = Math.floor(
      Number(body.productId),
    )
  }

  if (
    body.promotionalPrice !== undefined
  ) {
    patch.promotionalPrice = Number(
      body.promotionalPrice,
    )
  }

  if (body.startDate !== undefined) {
    patch.startDate = body.startDate
      ? String(body.startDate)
      : ""
  }

  if (body.endDate !== undefined) {
    patch.endDate = body.endDate
      ? String(body.endDate)
      : ""
  }

  if (
    Array.isArray(body.daysOfWeek)
  ) {
    patch.daysOfWeek =
      body.daysOfWeek.map(Number)
  }

  if (body.startTime !== undefined) {
    patch.startTime = String(
      body.startTime,
    )
  }

  if (body.endTime !== undefined) {
    patch.endTime = String(
      body.endTime,
    )
  }

  if (
    body.recurringWeekly !== undefined
  ) {
    patch.recurringWeekly =
      Boolean(
        body.recurringWeekly,
      )
  }

  if (body.active !== undefined) {
    patch.active = Boolean(
      body.active,
    )
  }

  if (body.highlight !== undefined) {
    patch.highlight = Boolean(
      body.highlight,
    )
  }

  if (body.label !== undefined) {
    patch.label = String(body.label)
  }

  return patch
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  },
) {
  if (
    !requestIsSameOrigin(request)
  ) {
    return NextResponse.json(
      {
        error:
          "Origem da requisicao nao permitida.",
      },
      { status: 403 },
    )
  }

  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 },
    )
  }

  try {
    const session =
      await getVerifiedTenantSession()

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Sessao tenant obrigatoria.",
        },
        { status: 401 },
      )
    }

    if (
      !canManageMarketing(
        session.role,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu perfil nao pode gerenciar promocoes.",
        },
        { status: 403 },
      )
    }

    const { id } =
      await context.params

    if (
      !/^[0-9a-f-]{36}$/i.test(id)
    ) {
      return NextResponse.json(
        {
          error:
            "Promocao invalida.",
        },
        { status: 400 },
      )
    }

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | Record<string, unknown>
        | null

    if (!body) {
      throw new Error(
        "Dados da promocao obrigatorios.",
      )
    }

    const promotion =
      await runWithTenantRlsScope(
        [session.organizationId],
        session.userId,
        () =>
          updateTenantProductPromotion(
            session.organizationId,
            id,
            patchFromBody(body),
          ),
        "tenant-session",
      )

    if (!promotion) {
      return NextResponse.json(
        {
          error:
            "Promocao nao encontrada.",
        },
        { status: 404 },
      )
    }

    const {
      invalidatePublicStoreCache,
    } = await import(
      "@/lib/public-store-db"
    )

    invalidatePublicStoreCache(
      session.organizationId,
    )

    return NextResponse.json({
      promotion,
    })
  } catch (error) {
    console.error(
      "[promotions:PATCH]",
      error,
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a promocao.",
      },
      { status: 400 },
    )
  }
}
`

// ------------------------------------------------------------
// 3) Validacao antes de gravar
// ------------------------------------------------------------

const validations = [
  [nextMarketing, "promotionMessage", "feedback promocao"],
  [nextMarketing, "responseText", "resposta da API"],
  [nextMarketing, "Promocao criada com sucesso.", "sucesso promocao"],
  [routeContent, "runWithTenantRlsScope", "RLS POST/GET"],
  [itemRouteContent, "runWithTenantRlsScope", "RLS PATCH"],
]

for (const [content, signal, label] of validations) {
  if (!content.includes(signal)) {
    throw new Error(
      `Validacao falhou: ${label}. Nenhum arquivo foi alterado.`
    )
  }
}

// ------------------------------------------------------------
// 4) Backups e gravacao
// ------------------------------------------------------------

fs.copyFileSync(marketingFile, `${marketingFile}.bak1483`)
fs.copyFileSync(routeFile, `${routeFile}.bak1483`)
fs.copyFileSync(itemRouteFile, `${itemRouteFile}.bak1483`)

fs.writeFileSync(marketingFile, nextMarketing, "utf8")
fs.writeFileSync(routeFile, routeContent, "utf8")
fs.writeFileSync(itemRouteFile, itemRouteContent, "utf8")

console.log("")
console.log("==============================================")
console.log("HOTFIX 14.8.3 APLICADO")
console.log("==============================================")
console.log("- Erro/sucesso da promocao aparece junto ao botao")
console.log("- POST/GET de promocoes agora usam escopo RLS explicito")
console.log("- PATCH de promocoes agora usa escopo RLS explicito")
console.log("- Resposta HTTP inesperada tambem fica visivel no formulario")
console.log("- Logs de erro foram adicionados no backend")
console.log("")
console.log("Backups .bak1483 criados.")
console.log("Agora execute: npm run build")
