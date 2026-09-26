import { NextResponse } from "next/server"
import {
  getTenantUnprintedOrders,
  markTenantOrderPrinted,
} from "@/lib/order-db"
import { getTenantSettings } from "@/lib/organization-db"
import { authenticatePrintAgent } from "@/lib/organization-security-db"
import { assertDemoActionAllowed } from "@/lib/demo-policy"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import {
  finiteNumber,
  InputValidationError,
  readJsonObject,
  validationErrorStatus,
} from "@/lib/security/input-validation"

type PrintContext = {
  agentId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  agentName: string
}

function requestToken(request: Request) {
  const token = (
    request.headers.get("x-print-token") ||
    new URL(request.url).searchParams.get("token") ||
    ""
  ).trim()

  return token.length <= 512 ? token : ""
}

async function resolvePrintContext(
  request: Request,
): Promise<PrintContext | null> {
  const token = requestToken(request)
  if (!token) return null

  const tenantAgent = await authenticatePrintAgent(token).catch(() => null)
  if (!tenantAgent) return null

  return {
    agentId: tenantAgent.agentId,
    organizationId: tenantAgent.organizationId,
    organizationName: tenantAgent.organizationName,
    organizationSlug: tenantAgent.organizationSlug,
    agentName: tenantAgent.agentName,
  }
}

function publicPrintSettings(settings: {
  storeName: string
  address: string
  printerName: string
  printCopies: number
  autoPrintNewOrders: boolean
  printKitchenTicket: boolean
  printCustomerTicket: boolean
  timeZone?: string
}) {
  return {
    storeName: settings.storeName,
    address: settings.address,
    printerName: settings.printerName,
    printCopies: settings.printCopies,
    autoPrintNewOrders: settings.autoPrintNewOrders,
    printKitchenTicket: settings.printKitchenTicket,
    printCustomerTicket: settings.printCustomerTicket,
    timeZone: settings.timeZone || "America/Sao_Paulo",
  }
}

function printOrdersWithLocalTime<T extends { requestedFor: string }>(
  orders: T[],
  timeZone: string,
) {
  return orders.map((order) => ({
    ...order,
    requestedForLocal: new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(order.requestedFor)),
  }))
}

export async function GET(request: Request) {
  const context = await resolvePrintContext(request)
  if (!context) {
    return NextResponse.json(
      { error: "Agente de impressão não autorizado." },
      { status: 401 },
    )
  }

  try {
    await assertDemoActionAllowed(context.organizationId, "external-print")
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impressão bloqueada na demonstração.",
      },
      { status: 403 },
    )
  }

  const [orders, settings] = await runWithTenantRlsScope(
    [context.organizationId],
    undefined,
    () => Promise.all([
      getTenantUnprintedOrders(context.organizationId),
      getTenantSettings(context.organizationId),
    ]),
    "privileged-backend",
  )

  if (!orders || !settings) {
    return NextResponse.json(
      { error: "Fila de impressão desta empresa ainda não está pronta." },
      { status: 503 },
    )
  }

  return NextResponse.json({
    organization: {
      id: context.organizationId,
      name: context.organizationName,
      slug: context.organizationSlug,
    },
    agent: { name: context.agentName },
    orders: settings.printerAgentId && settings.printerAgentId !== context.agentId ? [] : printOrdersWithLocalTime(
      orders,
      settings.timeZone || "America/Sao_Paulo",
    ),
    settings: publicPrintSettings(settings),
  })
}

export async function POST(request: Request) {
  const context = await resolvePrintContext(request)
  if (!context) {
    return NextResponse.json(
      { error: "Agente de impressão não autorizado." },
      { status: 401 },
    )
  }

  let id: number
  try {
    const body = await readJsonObject(request, 4 * 1024)
    if (!body) throw new InputValidationError("Corpo da requisição obrigatório.")
    id = finiteNumber(body.orderId, "Pedido", {
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      integer: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pedido inválido." },
      { status: validationErrorStatus(error) },
    )
  }

  try {
    await assertDemoActionAllowed(context.organizationId, "external-print")
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impressão bloqueada na demonstração.",
      },
      { status: 403 },
    )
  }

  const { settings, order } = await runWithTenantRlsScope(
    [context.organizationId],
    undefined,
    async () => {
      const settings = await getTenantSettings(context.organizationId)
      const order = settings?.printerAgentId && settings.printerAgentId !== context.agentId
        ? null
        : await markTenantOrderPrinted(context.organizationId, id)
      return { settings, order }
    },
    "privileged-backend",
  )
  if (settings?.printerAgentId && settings.printerAgentId !== context.agentId) return NextResponse.json({ error: "Este computador não está selecionado para imprimir." }, { status: 403 })
  if (!order) {
    return NextResponse.json(
      { error: "Pedido não encontrado na empresa deste agente." },
      { status: 404 },
    )
  }

  return NextResponse.json({ order })
}
