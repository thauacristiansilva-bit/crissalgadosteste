import { NextResponse } from "next/server"

import {
  generateGeminiText,
  type GeminiChatMessage,
} from "@/lib/ai/gemini"
import { SABORFLOW_AI_SYSTEM_PROMPT } from "@/lib/ai/saborflow-assistant"
import { zonedDateString } from "@/lib/operations"
import { permissionListHas } from "@/lib/operational-permissions"
import { getOperationalAccessForSession } from "@/lib/operational-rbac"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getTenantAwareAdminData } from "@/lib/tenant-admin-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 16 * 1024
const MAX_MESSAGES = 3
const MAX_MESSAGE_CHARS = 1_000
const MAX_TOTAL_CHARS = 2_500

const BUSINESS_SCOPE =
  /\b(saborflow|painel|sistema|empresa|loja|pedido|pedidos|venda|vendas|vendi|vendeu|vendemos|faturamento|faturei|receita|financeir|caixa|produto|produtos|card[aÃ¡]pio|estoque|cliente|clientes|cupom|cupons|entrega|delivery|retirada|cozinha|pagamento|pix|cart[aÃ£]o|dinheiro|categoria|categorias|relat[oÃ³]rio|dre|equipe|funcion[aÃ¡]rio|usu[aÃ¡]rio|acesso|configura[cÃ§][aÃ£]o|whatsapp|marketing|avalia[cÃ§][aÃ£]o|fidelidade|pontos|hor[aÃ¡]rio|abert|fechad|pre[cÃ§]o|valor|total|status|cancelad|pendente|pronto|aceito|estoque baixo|mais vendido|menos vendido)\b/i

const FINANCIAL_SCOPE =
  /\b(faturamento|faturei|receita|lucro|financeir|caixa|dre|total vendido|quanto vendi|valor vendido)\b/i

function headers() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  }
}

function fail(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: headers() },
  )
}

function normalizeMessages(value: unknown): GeminiChatMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) {
    return null
  }

  const messages: GeminiChatMessage[] = []
  let total = 0

  for (const item of value) {
    if (!item || typeof item !== "object") return null

    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content

    if (role !== "user" && role !== "assistant") return null
    if (typeof content !== "string") return null

    const text = content.trim()
    if (!text || text.length > MAX_MESSAGE_CHARS) return null

    total += text.length
    if (total > MAX_TOTAL_CHARS) return null

    messages.push({
      role: role === "assistant" ? "model" : "user",
      text,
    })
  }

  if (messages[messages.length - 1]?.role !== "user") return null
  return messages
}

function safeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return fail("Origem da requisiÃ§Ã£o nÃ£o permitida.", 403)
  }

  const session = await getVerifiedTenantSession()

  if (!session) {
    return fail("NÃ£o autorizado.", 401)
  }

  const raw = await request.text()

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return fail("Mensagem muito grande.", 413)
  }

  let body: unknown

  try {
    body = JSON.parse(raw)
  } catch {
    return fail("JSON invÃ¡lido.", 400)
  }

  const messages = normalizeMessages(
    (body as { messages?: unknown })?.messages,
  )

  if (!messages) {
    return fail("Mensagem invÃ¡lida.", 400)
  }

  const question = messages[messages.length - 1]?.text || ""

  if (!BUSINESS_SCOPE.test(question)) {
    return NextResponse.json(
      {
        ok: true,
        reply:
          "Posso ajudar apenas com assuntos relacionados Ã  sua empresa e ao SaborFlow.",
        model: "saborflow-scope-guard",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      },
      { headers: headers() },
    )
  }

  try {
    const access =
      session.mode === "tenant"
        ? await getOperationalAccessForSession(session)
        : null

    const data = await getTenantAwareAdminData(
      session,
      access?.permissions,
    )

    if (!data.settings.chatbotEnabled) {
      return fail("A IA estÃ¡ desativada para esta empresa.", 403)
    }

    const canViewFinance =
      session.mode === "tenant" &&
      Boolean(access) &&
      permissionListHas(
        access?.permissions || [],
        "finance.view",
      )

    if (FINANCIAL_SCOPE.test(question) && !canViewFinance) {
      return NextResponse.json(
        {
          ok: true,
          reply:
            "Seu acesso nÃ£o possui permissÃ£o para consultar informaÃ§Ãµes financeiras desta empresa.",
          model: "saborflow-permission-guard",
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
        },
        { headers: headers() },
      )
    }

    const settings = data.settings
    const orders = Array.isArray(data.orders) ? data.orders : []
    const products = Array.isArray(data.products) ? data.products : []

    const timeZone = settings.timeZone || "America/Sao_Paulo"
    const today = zonedDateString(new Date(), timeZone)

    const validOrders = orders.filter(
      (order) => order.status !== "cancelled",
    )

    const todayOrders = validOrders.filter(
      (order) =>
        zonedDateString(
          new Date(order.createdAt),
          timeZone,
        ) === today,
    )

    const openOrders = orders.filter((order) =>
      ["pending", "accepted", "preparing", "ready", "in-route"].includes(
        order.status,
      ),
    )

    const lowStock = products
      .filter(
        (product) =>
          product.trackStock &&
          safeNumber(product.stock) <= safeNumber(product.minStock),
      )
      .slice(0, 15)

    const productContext = products
      .slice(0, 30)
      .map((product) => {
        const stock = product.trackStock
          ? ` | estoque=${safeNumber(product.stock)}`
          : ""

        return `${product.name} | preÃ§o=${safeNumber(product.price).toFixed(
          2,
        )} | ativo=${product.active ? "sim" : "nÃ£o"}${stock}`
      })
      .join("\n")

    const recentOrders = orders
      .slice(0, 12)
      .map((order) => {
        const total = canViewFinance
          ? ` | total=R$ ${safeNumber(order.total).toFixed(2)}`
          : ""

        return `${order.code} | status=${order.status} | tipo=${order.type}${total} | criado=${order.createdAt}`
      })
      .join("\n")

    const financeContext = canViewFinance
      ? `
Faturamento hoje: R$ ${todayOrders
          .reduce((sum, order) => sum + safeNumber(order.total), 0)
          .toFixed(2)}
Faturamento dos pedidos carregados: R$ ${validOrders
          .reduce((sum, order) => sum + safeNumber(order.total), 0)
          .toFixed(2)}
`
      : `
Dados financeiros: restritos para este usuÃ¡rio.
`

    const context = `
CONTEXTO DA EMPRESA
Empresa: ${settings.storeName}
Cidade/UF: ${settings.city} - ${settings.state}
Fuso horÃ¡rio: ${timeZone}
Data local: ${today}
Aceitando pedidos: ${settings.acceptingOrders ? "sim" : "nÃ£o"}
Retirada: ${settings.pickupEnabled ? "sim" : "nÃ£o"}
Entrega: ${settings.deliveryEnabled ? "sim" : "nÃ£o"}
Pedidos hoje: ${todayOrders.length}
Pedidos em andamento: ${openOrders.length}
Produtos carregados: ${products.length}
Produtos com estoque baixo: ${lowStock.length}${
      lowStock.length
        ? ` (${lowStock.map((product) => product.name).join(", ")})`
        : ""
    }
${financeContext}
PRODUTOS DISPONÃVEIS NO CONTEXTO:
${productContext || "Nenhum produto disponÃ­vel para este acesso."}

PEDIDOS RECENTES NO CONTEXTO:
${recentOrders || "Nenhum pedido disponÃ­vel para este acesso."}
`.trim()

    const result = await generateGeminiText({
      systemInstruction: `${SABORFLOW_AI_SYSTEM_PROMPT}\n\n${context}`,
      messages,
    })

    return NextResponse.json(
      {
        ok: true,
        reply: result.text,
        model: result.model,
        usage: result.usage,
      },
      { headers: headers() },
    )
  } catch (error) {
    console.error(
      "Falha no chat IA:",
      error instanceof Error ? error.message : error,
    )

    return fail("A IA estÃ¡ temporariamente indisponÃ­vel.", 502)
  }
}
