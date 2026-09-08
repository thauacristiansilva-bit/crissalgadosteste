import {
  randomUUID,
} from "node:crypto"

import {
  NextResponse,
} from "next/server"

import {
  generateGeminiText,
  type GeminiChatMessage,
} from "@/lib/ai/gemini"
import {
  SABORFLOW_AI_SYSTEM_PROMPT,
} from "@/lib/ai/saborflow-assistant"
import {
  getBillingSnapshotForOrganization,
} from "@/lib/billing-db"
import {
  getTenantSettings,
} from "@/lib/organization-db"
import {
  zonedDateString,
} from "@/lib/operations"
import {
  permissionListHas,
} from "@/lib/operational-permissions"
import {
  getOperationalAccessForSession,
} from "@/lib/operational-rbac"
import {
  getPostgresPool,
} from "@/lib/postgres"
import {
  requestIsSameOrigin,
} from "@/lib/security/request-security"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"
import {
  getTenantAwareAdminData,
} from "@/lib/tenant-admin-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES =
  16 * 1024
const MAX_MESSAGES = 3
const MAX_MESSAGE_CHARS = 1_000
const MAX_TOTAL_CHARS = 2_500

const AI_DAILY_QUESTION_LIMIT = 30
const AI_COUNTER_KEY =
  "ai_questions"

const BUSINESS_SCOPE =
  /\b(saborflow|painel|sistema|empresa|loja|pedido|pedidos|venda|vendas|vendi|vendeu|vendemos|faturamento|faturei|receita|financeir|caixa|produto|produtos|card[aá]pio|estoque|cliente|clientes|cupom|cupons|entrega|delivery|retirada|cozinha|pagamento|pix|cart[aã]o|dinheiro|categoria|categorias|relat[oó]rio|dre|equipe|funcion[aá]rio|usu[aá]rio|acesso|configura[cç][aã]o|whatsapp|marketing|avalia[cç][aã]o|fidelidade|pontos|hor[aá]rio|abert|fechad|pre[cç]o|valor|total|status|cancelad|pendente|pronto|aceito|estoque baixo|mais vendido|menos vendido)\b/i

const FINANCIAL_SCOPE =
  /\b(faturamento|faturei|receita|lucro|financeir|caixa|dre|total vendido|quanto vendi|valor vendido)\b/i

type DailyUsage = {
  used: number
  limit: number
  remaining: number
  periodKey: string
}

function headers() {
  return {
    "Cache-Control":
      "no-store, max-age=0",
    "X-Content-Type-Options":
      "nosniff",
  }
}

function fail(
  error: string,
  status: number,
  dailyUsage?: DailyUsage,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(dailyUsage
        ? { dailyUsage }
        : {}),
    },
    {
      status,
      headers: headers(),
    },
  )
}

function usagePayload(
  used: number,
  periodKey: string,
): DailyUsage {
  const safeUsed =
    Math.max(
      0,
      Math.trunc(used),
    )

  return {
    used: safeUsed,
    limit:
      AI_DAILY_QUESTION_LIMIT,
    remaining:
      Math.max(
        0,
        AI_DAILY_QUESTION_LIMIT -
          safeUsed,
      ),
    periodKey,
  }
}

function normalizeMessages(
  value: unknown,
): GeminiChatMessage[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_MESSAGES
  ) {
    return null
  }

  const messages:
    GeminiChatMessage[] = []

  let total = 0

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return null
    }

    const role =
      (item as {
        role?: unknown
      }).role

    const content =
      (item as {
        content?: unknown
      }).content

    if (
      role !== "user" &&
      role !== "assistant"
    ) {
      return null
    }

    if (
      typeof content !== "string"
    ) {
      return null
    }

    const text =
      content.trim()

    if (
      !text ||
      text.length >
        MAX_MESSAGE_CHARS
    ) {
      return null
    }

    total += text.length

    if (
      total >
      MAX_TOTAL_CHARS
    ) {
      return null
    }

    messages.push({
      role:
        role === "assistant"
          ? "model"
          : "user",
      text,
    })
  }

  if (
    messages[
      messages.length - 1
    ]?.role !== "user"
  ) {
    return null
  }

  return messages
}

function safeNumber(
  value: unknown,
) {
  const parsed =
    Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

async function billingAccountId(
  organizationId: string,
) {
  const billing =
    await getBillingSnapshotForOrganization(
      organizationId,
    )

  return (
    billing.account?.id ||
    null
  )
}

async function readDailyUsage(
  organizationId: string,
  periodKey: string,
) {
  const accountId =
    await billingAccountId(
      organizationId,
    )

  if (!accountId) {
    throw new Error(
      "Conta de cobrança da empresa não encontrada.",
    )
  }

  const result =
    await getPostgresPool()
      .query<{
        value: string | number
      }>(
        `
          SELECT value
          FROM sf_usage_counters
          WHERE billing_account_id = $1
            AND organization_id = $2
            AND counter_key = $3
            AND period_key = $4
          LIMIT 1
        `,
        [
          accountId,
          organizationId,
          AI_COUNTER_KEY,
          periodKey,
        ],
      )

  return usagePayload(
    Number(
      result.rows[0]?.value ||
        0,
    ),
    periodKey,
  )
}

async function reserveDailyQuestion(
  organizationId: string,
  periodKey: string,
) {
  const accountId =
    await billingAccountId(
      organizationId,
    )

  if (!accountId) {
    throw new Error(
      "Conta de cobrança da empresa não encontrada.",
    )
  }

  const pool =
    getPostgresPool()

  await pool.query(
    `
      INSERT INTO sf_usage_counters (
        id,
        billing_account_id,
        organization_id,
        counter_key,
        period_key,
        value,
        updated_at,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        0,
        now(),
        now()
      )
      ON CONFLICT DO NOTHING
    `,
    [
      randomUUID(),
      accountId,
      organizationId,
      AI_COUNTER_KEY,
      periodKey,
    ],
  )

  const updated =
    await pool.query<{
      value: string | number
    }>(
      `
        UPDATE sf_usage_counters
        SET
          value = value + 1,
          updated_at = now()
        WHERE billing_account_id = $1
          AND organization_id = $2
          AND counter_key = $3
          AND period_key = $4
          AND value < $5
        RETURNING value
      `,
      [
        accountId,
        organizationId,
        AI_COUNTER_KEY,
        periodKey,
        AI_DAILY_QUESTION_LIMIT,
      ],
    )

  if (!updated.rows[0]) {
    return {
      allowed: false,
      usage:
        await readDailyUsage(
          organizationId,
          periodKey,
        ),
    }
  }

  return {
    allowed: true,
    usage: usagePayload(
      Number(
        updated.rows[0].value,
      ),
      periodKey,
    ),
  }
}

async function refundDailyQuestion(
  organizationId: string,
  periodKey: string,
) {
  const accountId =
    await billingAccountId(
      organizationId,
    )

  if (!accountId) return

  await getPostgresPool()
    .query(
      `
        UPDATE sf_usage_counters
        SET
          value = GREATEST(value - 1, 0),
          updated_at = now()
        WHERE billing_account_id = $1
          AND organization_id = $2
          AND counter_key = $3
          AND period_key = $4
      `,
      [
        accountId,
        organizationId,
        AI_COUNTER_KEY,
        periodKey,
      ],
    )
    .catch(() => undefined)
}

async function tenantAiContext() {
  const session =
    await getVerifiedTenantSession()

  if (
    !session ||
    session.mode !== "tenant"
  ) {
    return null
  }

  const settings =
    await getTenantSettings(
      session.organizationId,
    )

  if (!settings) {
    return null
  }

  const timeZone =
    settings.timeZone ||
    "America/Sao_Paulo"

  const localDate =
    zonedDateString(
      new Date(),
      timeZone,
    )

  return {
    session,
    settings,
    timeZone,
    periodKey:
      `day:${localDate}`,
  }
}

export async function GET() {
  try {
    const context =
      await tenantAiContext()

    if (!context) {
      return fail(
        "Não autorizado.",
        401,
      )
    }

    const dailyUsage =
      await readDailyUsage(
        context.session
          .organizationId,
        context.periodKey,
      )

    return NextResponse.json(
      {
        ok: true,
        enabled:
          Boolean(
            context.settings
              .chatbotEnabled,
          ),
        dailyUsage,
      },
      {
        headers: headers(),
      },
    )
  } catch (error) {
    console.error(
      "Falha ao consultar uso diário da IA:",
      error instanceof Error
        ? error.message
        : error,
    )

    return fail(
      "Não foi possível consultar o limite diário da IA.",
      502,
    )
  }
}

export async function POST(
  request: Request,
) {
  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
    return fail(
      "Origem da requisição não permitida.",
      403,
    )
  }

  const context =
    await tenantAiContext()

  if (!context) {
    return fail(
      "Não autorizado.",
      401,
    )
  }

  const {
    session,
    settings:
      lightweightSettings,
    timeZone,
    periodKey,
  } = context

  let dailyUsage:
    DailyUsage

  try {
    dailyUsage =
      await readDailyUsage(
        session.organizationId,
        periodKey,
      )
  } catch {
    return fail(
      "Não foi possível validar o limite diário da IA.",
      502,
    )
  }

  if (
    !lightweightSettings
      .chatbotEnabled
  ) {
    return fail(
      "A IA está desativada para esta empresa.",
      403,
      dailyUsage,
    )
  }

  const raw =
    await request.text()

  if (
    Buffer.byteLength(
      raw,
      "utf8",
    ) > MAX_BODY_BYTES
  ) {
    return fail(
      "Mensagem muito grande.",
      413,
      dailyUsage,
    )
  }

  let body: unknown

  try {
    body =
      JSON.parse(raw)
  } catch {
    return fail(
      "JSON inválido.",
      400,
      dailyUsage,
    )
  }

  const messages =
    normalizeMessages(
      (
        body as {
          messages?: unknown
        }
      )?.messages,
    )

  if (!messages) {
    return fail(
      "Mensagem inválida.",
      400,
      dailyUsage,
    )
  }

  const question =
    messages[
      messages.length - 1
    ]?.text || ""

  if (
    !BUSINESS_SCOPE.test(
      question,
    )
  ) {
    return NextResponse.json(
      {
        ok: true,
        reply:
          "Posso ajudar apenas com assuntos relacionados à sua empresa e ao SaborFlow.",
        model:
          "saborflow-scope-guard",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        dailyUsage,
      },
      {
        headers: headers(),
      },
    )
  }

  if (
    dailyUsage.remaining <= 0
  ) {
    return fail(
      `Esta empresa atingiu o limite de ${AI_DAILY_QUESTION_LIMIT} perguntas da IA hoje. O contador reinicia amanhã.`,
      429,
      dailyUsage,
    )
  }

  let reservation:
    Awaited<
      ReturnType<
        typeof reserveDailyQuestion
      >
    >

  try {
    reservation =
      await reserveDailyQuestion(
        session.organizationId,
        periodKey,
      )
  } catch {
    return fail(
      "Não foi possível registrar o uso diário da IA.",
      502,
      dailyUsage,
    )
  }

  if (!reservation.allowed) {
    return fail(
      `Esta empresa atingiu o limite de ${AI_DAILY_QUESTION_LIMIT} perguntas da IA hoje. O contador reinicia amanhã.`,
      429,
      reservation.usage,
    )
  }

  dailyUsage =
    reservation.usage

  try {
    const access =
      await getOperationalAccessForSession(
        session,
      )

    const data =
      await getTenantAwareAdminData(
        session,
        access?.permissions,
      )

    const canViewFinance =
      Boolean(access) &&
      permissionListHas(
        access?.permissions || [],
        "finance.view",
      )

    if (
      FINANCIAL_SCOPE.test(
        question,
      ) &&
      !canViewFinance
    ) {
      await refundDailyQuestion(
        session.organizationId,
        periodKey,
      )

      const refunded =
        await readDailyUsage(
          session.organizationId,
          periodKey,
        ).catch(
          () => dailyUsage,
        )

      return NextResponse.json(
        {
          ok: true,
          reply:
            "Seu acesso não possui permissão para consultar informações financeiras desta empresa.",
          model:
            "saborflow-permission-guard",
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          dailyUsage:
            refunded,
        },
        {
          headers:
            headers(),
        },
      )
    }

    const settings =
      data.settings

    const orders =
      Array.isArray(
        data.orders,
      )
        ? data.orders
        : []

    const products =
      Array.isArray(
        data.products,
      )
        ? data.products
        : []

    const today =
      zonedDateString(
        new Date(),
        timeZone,
      )

    const validOrders =
      orders.filter(
        (order) =>
          order.status !==
          "cancelled",
      )

    const todayOrders =
      validOrders.filter(
        (order) =>
          zonedDateString(
            new Date(
              order.createdAt,
            ),
            timeZone,
          ) === today,
      )

    const openOrders =
      orders.filter(
        (order) =>
          [
            "pending",
            "accepted",
            "preparing",
            "ready",
            "in-route",
          ].includes(
            order.status,
          ),
      )

    const lowStock =
      products
        .filter(
          (product) =>
            product.trackStock &&
            safeNumber(
              product.stock,
            ) <=
              safeNumber(
                product.minStock,
              ),
        )
        .slice(0, 15)

    const productContext =
      products
        .slice(0, 30)
        .map(
          (product) => {
            const stock =
              product.trackStock
                ? ` | estoque=${safeNumber(
                    product.stock,
                  )}`
                : ""

            return `${product.name} | preço=${safeNumber(
              product.price,
            ).toFixed(
              2,
            )} | ativo=${
              product.active
                ? "sim"
                : "não"
            }${stock}`
          },
        )
        .join("\n")

    const recentOrders =
      orders
        .slice(0, 12)
        .map(
          (order) => {
            const total =
              canViewFinance
                ? ` | total=R$ ${safeNumber(
                    order.total,
                  ).toFixed(
                    2,
                  )}`
                : ""

            return `${order.code} | status=${order.status} | tipo=${order.type}${total} | criado=${order.createdAt}`
          },
        )
        .join("\n")

    const financeContext =
      canViewFinance
        ? `
Faturamento hoje: R$ ${todayOrders
            .reduce(
              (
                sum,
                order,
              ) =>
                sum +
                safeNumber(
                  order.total,
                ),
              0,
            )
            .toFixed(2)}
Faturamento dos pedidos carregados: R$ ${validOrders
            .reduce(
              (
                sum,
                order,
              ) =>
                sum +
                safeNumber(
                  order.total,
                ),
              0,
            )
            .toFixed(2)}
`
        : `
Dados financeiros: restritos para este usuário.
`

    const aiContext = `
CONTEXTO DA EMPRESA
Empresa: ${settings.storeName}
Cidade/UF: ${settings.city} - ${settings.state}
Fuso horário: ${timeZone}
Data local: ${today}
Aceitando pedidos: ${settings.acceptingOrders ? "sim" : "não"}
Retirada: ${settings.pickupEnabled ? "sim" : "não"}
Entrega: ${settings.deliveryEnabled ? "sim" : "não"}
Pedidos hoje: ${todayOrders.length}
Pedidos em andamento: ${openOrders.length}
Produtos carregados: ${products.length}
Produtos com estoque baixo: ${lowStock.length}${
      lowStock.length
        ? ` (${lowStock
            .map(
              (product) =>
                product.name,
            )
            .join(", ")})`
        : ""
    }
${financeContext}
PRODUTOS DISPONÍVEIS NO CONTEXTO:
${productContext || "Nenhum produto disponível para este acesso."}

PEDIDOS RECENTES NO CONTEXTO:
${recentOrders || "Nenhum pedido disponível para este acesso."}
`.trim()

    const result =
      await generateGeminiText(
        {
          systemInstruction:
            `${SABORFLOW_AI_SYSTEM_PROMPT}\n\n${aiContext}`,
          messages,
        },
      )

    return NextResponse.json(
      {
        ok: true,
        reply:
          result.text,
        model:
          result.model,
        usage:
          result.usage,
        dailyUsage,
      },
      {
        headers:
          headers(),
      },
    )
  } catch (error) {
    await refundDailyQuestion(
      session.organizationId,
      periodKey,
    )

    console.error(
      "Falha no chat IA:",
      error instanceof Error
        ? error.message
        : error,
    )

    const refunded =
      await readDailyUsage(
        session.organizationId,
        periodKey,
      ).catch(
        () => dailyUsage,
      )

    return fail(
      "A IA está temporariamente indisponível.",
      502,
      refunded,
    )
  }
}
