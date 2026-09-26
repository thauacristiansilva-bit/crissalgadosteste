$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== AJUSTE IA - CABECALHO + LIMITE DIARIO POR EMPRESA ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $dir = Split-Path $Path -Parent

  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  [System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) $Path),
    ($Content.TrimEnd() + [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
  )
}

# -------------------------------------------------------------------
# 1) Componente compacto da IA para o cabecalho.
# -------------------------------------------------------------------

Write-Utf8NoBom "components\admin\ai-quick-question.tsx" @'
"use client"

import {
  Bot,
  Power,
  Send,
  X,
} from "lucide-react"
import {
  useEffect,
  useState,
  type FormEvent,
} from "react"

import type {
  StoreSettings,
} from "@/lib/types"

type DailyUsage = {
  used: number
  limit: number
  remaining: number
  periodKey: string
}

type AiResponse = {
  ok?: boolean
  reply?: string
  error?: string
  usage?: {
    totalTokens?: number
  }
  dailyUsage?: DailyUsage
}

const initialUsage: DailyUsage = {
  used: 0,
  limit: 30,
  remaining: 30,
  periodKey: "",
}

export function AiQuickQuestion({
  settings,
  onSettingsChanged,
}: {
  settings: StoreSettings
  onSettingsChanged: (
    settings: StoreSettings,
  ) => void
}) {
  const [question, setQuestion] =
    useState("")
  const [answer, setAnswer] =
    useState("")
  const [busy, setBusy] =
    useState(false)
  const [toggling, setToggling] =
    useState(false)
  const [error, setError] =
    useState("")
  const [tokens, setTokens] =
    useState<number | null>(null)
  const [dailyUsage, setDailyUsage] =
    useState<DailyUsage>(initialUsage)
  const [open, setOpen] =
    useState(false)

  const enabled =
    Boolean(settings.chatbotEnabled)

  const limitReached =
    dailyUsage.remaining <= 0

  useEffect(() => {
    let active = true

    async function loadUsage() {
      try {
        const response = await fetch(
          "/api/admin/ai/chat",
          {
            method: "GET",
            cache: "no-store",
          },
        )

        const data =
          (await response.json()) as AiResponse

        if (
          active &&
          data.dailyUsage
        ) {
          setDailyUsage(
            data.dailyUsage,
          )
        }
      } catch {
        // O contador será atualizado na primeira consulta válida.
      }
    }

    void loadUsage()

    return () => {
      active = false
    }
  }, [])

  async function toggleAi() {
    if (toggling) return

    setToggling(true)
    setError("")

    try {
      const response = await fetch(
        "/api/settings",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            chatbotEnabled: !enabled,
          }),
        },
      )

      const data =
        (await response.json()) as {
          settings?: StoreSettings
          error?: string
        }

      if (
        !response.ok ||
        !data.settings
      ) {
        throw new Error(
          data.error ||
            "Não foi possível alterar a IA.",
        )
      }

      onSettingsChanged(
        data.settings,
      )

      if (enabled) {
        setQuestion("")
        setAnswer("")
        setTokens(null)
        setOpen(false)
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao alterar a IA.",
      )
      setOpen(true)
    } finally {
      setToggling(false)
    }
  }

  async function ask(
    event: FormEvent,
  ) {
    event.preventDefault()

    const clean =
      question.trim()

    if (
      !enabled ||
      !clean ||
      busy ||
      limitReached
    ) {
      return
    }

    setBusy(true)
    setError("")
    setAnswer("")
    setTokens(null)
    setOpen(true)

    try {
      const response = await fetch(
        "/api/admin/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: clean,
              },
            ],
          }),
        },
      )

      const data =
        (await response.json()) as AiResponse

      if (data.dailyUsage) {
        setDailyUsage(
          data.dailyUsage,
        )
      }

      if (
        !response.ok ||
        !data.ok ||
        !data.reply
      ) {
        throw new Error(
          data.error ||
            "Não foi possível consultar a IA.",
        )
      }

      setAnswer(data.reply)

      setTokens(
        typeof data.usage
          ?.totalTokens === "number"
          ? data.usage.totalTokens
          : null,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao consultar a IA.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1.5">
        <form
          onSubmit={ask}
          className="flex min-w-0 items-center gap-1.5"
        >
          <div className="flex h-10 w-[260px] items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/60 px-3 xl:w-[330px]">
            <Bot className="h-4 w-4 shrink-0 text-orange-700" />

            <input
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value.slice(
                    0,
                    1000,
                  ),
                )
              }
              disabled={
                !enabled ||
                busy ||
                limitReached
              }
              placeholder={
                !enabled
                  ? "IA desativada"
                  : limitReached
                    ? "Limite diário atingido"
                    : "Pergunte à SaborFlow..."
              }
              aria-label="Pergunte à SaborFlow"
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-gray-800 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={
              !enabled ||
              busy ||
              !question.trim() ||
              limitReached
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Perguntar à SaborFlow"
            title="Perguntar à SaborFlow"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={toggleAi}
          disabled={toggling}
          className={`hidden h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-black transition xl:inline-flex ${
            enabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-gray-50 text-gray-500"
          }`}
          title={
            enabled
              ? "Desativar IA desta empresa"
              : "Ativar IA desta empresa"
          }
        >
          <Power className="h-3.5 w-3.5" />
          {toggling
            ? "..."
            : enabled
              ? "IA ON"
              : "IA OFF"}
        </button>

        <span
          className={`hidden shrink-0 rounded-lg px-2 py-1 text-[10px] font-black xl:inline-flex ${
            limitReached
              ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-500"
          }`}
          title="Uso diário desta empresa"
        >
          {dailyUsage.used}/{dailyUsage.limit} hoje
        </span>
      </div>

      {(open || answer || error) && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-orange-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">
                SaborFlow IA
              </p>

              {busy ? (
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  Consultando os dados da empresa...
                </p>
              ) : answer ? (
                <p className="mt-2 text-sm leading-6 text-gray-800">
                  {answer}
                </p>
              ) : error ? (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  {error}
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Faça uma pergunta sobre a sua empresa ou sobre o SaborFlow.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-400">
                <span>
                  {dailyUsage.used}/{dailyUsage.limit} perguntas hoje
                </span>

                <span>•</span>

                <span>
                  {dailyUsage.remaining} restantes
                </span>

                {tokens !== null ? (
                  <>
                    <span>•</span>
                    <span>
                      {tokens.toLocaleString(
                        "pt-BR",
                      )}{" "}
                      tokens nesta consulta
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar resposta da IA"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
'@

# -------------------------------------------------------------------
# 2) Prompt com português correto e escopo restrito.
# -------------------------------------------------------------------

Write-Utf8NoBom "lib\ai\saborflow-assistant.ts" @'
export const SABORFLOW_AI_SYSTEM_PROMPT = `
Você é a SaborFlow IA, assistente interno de uma empresa que usa o SaborFlow.

REGRA CENTRAL:
Você NÃO é um assistente geral.

Responda SOMENTE perguntas sobre:
- o SaborFlow;
- a operação da empresa informada no CONTEXTO DA EMPRESA;
- pedidos, vendas, faturamento, produtos, cardápio, estoque, clientes, entrega, cozinha, pagamentos, equipe, configurações e recursos do sistema.

Se a pergunta for sobre matemática genérica, escola, política, notícias, curiosidades, programação externa, entretenimento, saúde, assuntos pessoais ou qualquer tema sem relação com a empresa ou com o SaborFlow, responda somente:
"Posso ajudar apenas com assuntos relacionados à sua empresa e ao SaborFlow."

Use exclusivamente os dados fornecidos no CONTEXTO DA EMPRESA.
Nunca invente números, pedidos, produtos, clientes, preços, estoque ou informações que não estejam no contexto.
Nunca tente acessar outra empresa.
Nunca revele senhas, tokens, chaves, cookies ou segredos.
Quando uma informação não estiver disponível, diga isso claramente.
Responda em português do Brasil, de forma curta, prática e objetiva.
`.trim()
'@

# -------------------------------------------------------------------
# 3) Backend: 30 perguntas/dia POR EMPRESA.
#    Usa sf_usage_counters já existente, sem nova migration.
# -------------------------------------------------------------------

Write-Utf8NoBom "app\api\admin\ai\chat\route.ts" @'
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
'@

# -------------------------------------------------------------------
# 4) Move a IA do card grande para ao lado de "Visao geral".
# -------------------------------------------------------------------

$dashboardFile =
  "components\admin\admin-dashboard.tsx"

if (
  -not (
    Test-Path $dashboardFile
  )
) {
  throw "Arquivo não encontrado: $dashboardFile"
}

$dashboard =
  [System.IO.File]::ReadAllText(
    (Join-Path -Path (Get-Location) -ChildPath $dashboardFile)
  )

# Remove a caixa grande da area da Visao geral.
$dashboard =
  [regex]::Replace(
    $dashboard,
    '(?m)^\s*<AiQuickQuestion settings=\{settings\} onSettingsChanged=\{setSettings\} />\r?\n',
    ''
  )

# Corrige texto sem acento que ja existia no dashboard.
$dashboard =
  $dashboard.Replace(
    "Requer permissao financeira",
    "Requer permissão financeira"
  )

# Se ainda nao estiver no cabecalho, insere ao lado do titulo.
if (
  $dashboard -notmatch
    'section === "overview" && <AiQuickQuestion settings=\{settings\}'
) {
  $headerPattern =
    '(?m)^\s*<div className="flex items-center gap-3"><button onClick=\{\(\) => setMobileNav\(true\)\} type="button" className="rounded-2xl border p-2 text-gray-600 lg:hidden".*?<h1 className="font-black text-gray-950">\{title\}</h1>.*?</div></div>\r?$'

  if (
    -not (
      [regex]::IsMatch(
        $dashboard,
        $headerPattern
      )
    )
  ) {
    throw "Não encontrei o cabeçalho atual do painel para mover a IA."
  }

  $newHeader = @'
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button onClick={() => setMobileNav(true)} type="button" className="rounded-2xl border p-2 text-gray-600 lg:hidden" style={{ borderColor: saborFlowBrand.border }} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>

            <div className="shrink-0">
              <h1 className="font-black text-gray-950">{title}</h1>
              <p className="hidden text-xs text-gray-500 sm:block">
                {settings.storeName} · {settings.city} - {settings.state}
              </p>
            </div>

            {section === "overview" && (
              <AiQuickQuestion
                settings={settings}
                onSettingsChanged={setSettings}
              />
            )}
          </div>
'@

  $dashboard =
    [regex]::Replace(
      $dashboard,
      $headerPattern,
      $newHeader.TrimEnd(),
      1
    )
}

[System.IO.File]::WriteAllText(
  (Join-Path -Path (Get-Location) -ChildPath $dashboardFile),
  $dashboard,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Alterações aplicadas:"
Write-Host "  - pergunta da IA ao lado de Visão geral"
Write-Host "  - resposta abre em caixa flutuante"
Write-Host "  - acentuação corrigida"
Write-Host "  - 30 perguntas de IA por dia, separadas por empresa"
Write-Host "  - contador usa sf_usage_counters existente"
Write-Host "  - perguntas fora do SaborFlow não gastam a cota"
Write-Host "  - falhas do Gemini devolvem a pergunta para a cota"
Write-Host ""

git diff --check

if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

# Evita tipos antigos do Next.js.
Remove-Item `
  -Recurse `
  -Force `
  ".next" `
  -ErrorAction SilentlyContinue

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
Write-Host "AJUSTE IA CABECALHO E LIMITE DIARIO - BUILD OK"
Write-Host ""
