$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.3 - IA PROPRIA DA EMPRESA NO PAINEL PRINCIPAL ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)

  $dir = Split-Path $Path -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $clean = $Content.TrimEnd() + [Environment]::NewLine
  [System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) $Path),
    $clean,
    [System.Text.UTF8Encoding]::new($false)
  )
}

Write-Utf8NoBom "components\admin\ai-quick-question.tsx" @'
"use client"

import { Bot, Power, Send } from "lucide-react"
import { useState, type FormEvent } from "react"
import type { StoreSettings } from "@/lib/types"

type AiResponse = {
  ok?: boolean
  reply?: string
  error?: string
  usage?: { totalTokens?: number }
}

export function AiQuickQuestion({
  settings,
  onSettingsChanged,
}: {
  settings: StoreSettings
  onSettingsChanged: (settings: StoreSettings) => void
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [busy, setBusy] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState("")
  const [tokens, setTokens] = useState<number | null>(null)

  const enabled = Boolean(settings.chatbotEnabled)

  async function toggleAi() {
    if (toggling) return

    setToggling(true)
    setError("")

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotEnabled: !enabled }),
      })

      const data = (await response.json()) as {
        settings?: StoreSettings
        error?: string
      }

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Não foi possível alterar a IA.")
      }

      onSettingsChanged(data.settings)

      if (enabled) {
        setQuestion("")
        setAnswer("")
        setTokens(null)
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao alterar a IA.",
      )
    } finally {
      setToggling(false)
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault()

    const clean = question.trim()
    if (!enabled || !clean || busy) return

    setBusy(true)
    setError("")
    setAnswer("")
    setTokens(null)

    try {
      const response = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: clean }],
        }),
      })

      const data = (await response.json()) as AiResponse

      if (!response.ok || !data.ok || !data.reply) {
        throw new Error(
          data.error || "Não foi possível consultar a IA.",
        )
      }

      setAnswer(data.reply)
      setTokens(
        typeof data.usage?.totalTokens === "number"
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
    <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-950">
              Pergunte à SaborFlow
            </h2>
            <p className="text-xs text-gray-500">
              Responde somente sobre {settings.storeName} e o SaborFlow.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleAi}
          disabled={toggling}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition disabled:opacity-50 ${
            enabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-gray-50 text-gray-500"
          }`}
        >
          <Power className="h-3.5 w-3.5" />
          {toggling ? "Salvando..." : enabled ? "IA ON" : "IA OFF"}
        </button>
      </div>

      <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, 1000))}
          disabled={!enabled || busy}
          placeholder={
            enabled
              ? "Ex.: Quanto vendi hoje? Quais produtos estão com estoque baixo?"
              : "Ative a IA para fazer perguntas sobre a empresa."
          }
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-orange-300 disabled:bg-gray-50 disabled:text-gray-400"
        />

        <button
          type="submit"
          disabled={!enabled || busy || !question.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy ? "Consultando..." : "Perguntar"}
        </button>
      </form>

      {answer ? (
        <div className="mt-3 rounded-xl bg-orange-50 px-4 py-3 text-sm leading-relaxed text-gray-800">
          {answer}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-bold text-red-600">{error}</p>
      ) : null}

      {tokens !== null ? (
        <p className="mt-2 text-[10px] font-semibold text-gray-400">
          {tokens.toLocaleString("pt-BR")} tokens nesta consulta
        </p>
      ) : null}
    </section>
  )
}
'@

Write-Utf8NoBom "lib\ai\saborflow-assistant.ts" @'
export const SABORFLOW_AI_SYSTEM_PROMPT = `
Você é a SaborFlow IA, assistente interno de uma empresa que usa o SaborFlow.

REGRA CENTRAL:
Você NÃO é um assistente geral.
Responda SOMENTE perguntas sobre:
- o SaborFlow;
- a operação da empresa informada no CONTEXTO DA EMPRESA;
- pedidos, vendas, faturamento, produtos, cardápio, estoque, clientes, entrega, cozinha, pagamentos, equipe, configurações e recursos do sistema.

Se a pergunta for sobre matemática genérica, escola, política, notícias, curiosidades, programação externa, entretenimento, saúde, assuntos pessoais ou qualquer tema sem relação com a empresa/SaborFlow, responda somente:
"Posso ajudar apenas com assuntos relacionados à sua empresa e ao SaborFlow."

Use exclusivamente os dados fornecidos no CONTEXTO DA EMPRESA.
Nunca invente números, pedidos, produtos, clientes, preços, estoque ou informações que não estejam no contexto.
Nunca tente acessar outra empresa.
Nunca revele senhas, tokens, chaves, cookies ou segredos.
Quando uma informação não estiver disponível, diga isso claramente.
Responda em português do Brasil, de forma curta, prática e objetiva.
`.trim()
'@

Write-Utf8NoBom "app\api\admin\ai\chat\route.ts" @'
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
  /\b(saborflow|painel|sistema|empresa|loja|pedido|pedidos|venda|vendas|vendi|vendeu|vendemos|faturamento|faturei|receita|financeir|caixa|produto|produtos|card[aá]pio|estoque|cliente|clientes|cupom|cupons|entrega|delivery|retirada|cozinha|pagamento|pix|cart[aã]o|dinheiro|categoria|categorias|relat[oó]rio|dre|equipe|funcion[aá]rio|usu[aá]rio|acesso|configura[cç][aã]o|whatsapp|marketing|avalia[cç][aã]o|fidelidade|pontos|hor[aá]rio|abert|fechad|pre[cç]o|valor|total|status|cancelad|pendente|pronto|aceito|estoque baixo|mais vendido|menos vendido)\b/i

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
    return fail("Origem da requisição não permitida.", 403)
  }

  const session = await getVerifiedTenantSession()

  if (!session) {
    return fail("Não autorizado.", 401)
  }

  const raw = await request.text()

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return fail("Mensagem muito grande.", 413)
  }

  let body: unknown

  try {
    body = JSON.parse(raw)
  } catch {
    return fail("JSON inválido.", 400)
  }

  const messages = normalizeMessages(
    (body as { messages?: unknown })?.messages,
  )

  if (!messages) {
    return fail("Mensagem inválida.", 400)
  }

  const question = messages[messages.length - 1]?.text || ""

  if (!BUSINESS_SCOPE.test(question)) {
    return NextResponse.json(
      {
        ok: true,
        reply:
          "Posso ajudar apenas com assuntos relacionados à sua empresa e ao SaborFlow.",
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
      return fail("A IA está desativada para esta empresa.", 403)
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
            "Seu acesso não possui permissão para consultar informações financeiras desta empresa.",
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

        return `${product.name} | preço=${safeNumber(product.price).toFixed(
          2,
        )} | ativo=${product.active ? "sim" : "não"}${stock}`
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
Dados financeiros: restritos para este usuário.
`

    const context = `
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
        ? ` (${lowStock.map((product) => product.name).join(", ")})`
        : ""
    }
${financeContext}
PRODUTOS DISPONÍVEIS NO CONTEXTO:
${productContext || "Nenhum produto disponível para este acesso."}

PEDIDOS RECENTES NO CONTEXTO:
${recentOrders || "Nenhum pedido disponível para este acesso."}
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

    return fail("A IA está temporariamente indisponível.", 502)
  }
}
'@

$geminiFile = "lib\ai\gemini.ts"
if (-not (Test-Path $geminiFile)) {
  throw "Arquivo nao encontrado: $geminiFile"
}

$gemini = [System.IO.File]::ReadAllText(
  (Join-Path (Get-Location) $geminiFile)
)
$gemini = $gemini.Replace(
  "maxOutputTokens: 320",
  "maxOutputTokens: 240"
)
[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) $geminiFile),
  $gemini,
  [System.Text.UTF8Encoding]::new($false)
)

$dashboardFile = "components\admin\admin-dashboard.tsx"
if (-not (Test-Path $dashboardFile)) {
  throw "Arquivo nao encontrado: $dashboardFile"
}

$dashboard = [System.IO.File]::ReadAllText(
  (Join-Path (Get-Location) $dashboardFile)
)

$dashboard = [regex]::Replace(
  $dashboard,
  '(?m)^\s*Bot,\r?\n',
  ''
)

$dashboard = [regex]::Replace(
  $dashboard,
  '(?m)^import \{ ChatbotPanel \} from "@/components/admin/chatbot-panel"\r?\n',
  ''
)

if (-not $dashboard.Contains(
  'import { AiQuickQuestion } from "@/components/admin/ai-quick-question"'
)) {
  $anchor =
    'import { OrganizationSwitcher } from "@/components/admin/organization-switcher"'

  if (-not $dashboard.Contains($anchor)) {
    throw "Ponto de importacao do AiQuickQuestion nao encontrado."
  }

  $dashboard = $dashboard.Replace(
    $anchor,
    $anchor + [Environment]::NewLine +
      'import { AiQuickQuestion } from "@/components/admin/ai-quick-question"'
  )
}

$dashboard = [regex]::Replace(
  $dashboard,
  '(?m)^\s*\{ key: "chatbot", label: "Atendimento", icon: Bot, group: "clientes" \},\r?\n',
  ''
)

$dashboard = [regex]::Replace(
  $dashboard,
  '(?m)^\s*\{section === "chatbot" && <ChatbotPanel settings=\{settings\} onSettingsChanged=\{setSettings\} />\}\r?\n',
  ''
)

$overviewAnchor =
  '{section === "overview" && <div className="space-y-6">'

if (-not $dashboard.Contains($overviewAnchor)) {
  throw "Ponto do painel Visao geral nao encontrado."
}

if (-not $dashboard.Contains(
  '<AiQuickQuestion settings={settings} onSettingsChanged={setSettings} />'
)) {
  $dashboard = $dashboard.Replace(
    $overviewAnchor,
    $overviewAnchor + [Environment]::NewLine +
      '            <AiQuickQuestion settings={settings} onSettingsChanged={setSettings} />'
  )
}

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) $dashboardFile),
  $dashboard,
  [System.Text.UTF8Encoding]::new($false)
)

if (Test-Path "app\admin\ia\page.tsx") {
  Remove-Item "app\admin\ia\page.tsx" -Force
}

if (Test-Path "components\admin\ai-chat-panel.tsx") {
  Remove-Item "components\admin\ai-chat-panel.tsx" -Force
}

Write-Host ""
Write-Host "Alteracoes preparadas:"
Write-Host "  - IA dentro da Visao geral"
Write-Host "  - IA ON/OFF por empresa usando chatbotEnabled"
Write-Host "  - perguntas fora do SaborFlow bloqueadas sem gastar tokens"
Write-Host "  - contexto real e isolado da empresa"
Write-Host "  - protecao de dados financeiros por permissao"
Write-Host "  - pagina /admin/ia removida"
Write-Host "  - aba Atendimento removida do menu"
Write-Host "  - respostas reduzidas para economizar tokens"
Write-Host ""

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

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
Write-Host "ETAPA 14.3 IA EMPRESA/PAINEL APROVADA - BUILD OK"
Write-Host ""
