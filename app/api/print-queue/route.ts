import { NextResponse } from "next/server"
import {
  getSettings as getLegacySettings,
  getUnprintedOrders as getLegacyUnprintedOrders,
  markOrderPrinted as markLegacyOrderPrinted,
  syncLegacyOrderFromTenant,
} from "@/lib/db"
import {
  getTenantUnprintedOrders,
  markTenantOrderPrinted,
} from "@/lib/order-db"
import {
  getCurrentDeploymentOrganizationId,
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  getTenantSettings,
} from "@/lib/organization-db"
import {
  authenticatePrintAgent,
} from "@/lib/organization-security-db"

type PrintContext =
  | {
      mode: "tenant"
      organizationId: string
      organizationName: string
      organizationSlug: string
      agentName: string
    }
  | {
      mode: "legacy"
      organizationId:
        | string
        | null
      organizationName:
        string
      organizationSlug:
        string
      agentName:
        string
    }

function requestToken(
  request: Request,
) {
  return (
    request.headers.get(
      "x-print-token",
    ) ||
    new URL(
      request.url,
    ).searchParams.get(
      "token",
    ) ||
    ""
  )
}

async function resolvePrintContext(
  request: Request,
): Promise<PrintContext | null> {
  const token =
    requestToken(request)

  if (!token) return null

  const tenantAgent =
    await authenticatePrintAgent(
      token,
    ).catch(() => null)

  if (tenantAgent) {
    return {
      mode: "tenant",
      organizationId:
        tenantAgent.organizationId,
      organizationName:
        tenantAgent.organizationName,
      organizationSlug:
        tenantAgent.organizationSlug,
      agentName:
        tenantAgent.agentName,
    }
  }

  // Compatibilidade temporária com a Cris Salgados:
  // o token global antigo só acessa a organização original.
  const configured =
    process.env.PRINT_AGENT_TOKEN

  if (
    !configured ||
    token !== configured
  ) {
    return null
  }

  const organizationId =
    await getCurrentDeploymentOrganizationId()

  return {
    mode: "legacy",
    organizationId,
    organizationName:
      "Empresa original",
    organizationSlug: "",
    agentName:
      "Agente legado",
  }
}

function publicPrintSettings(
  settings: {
    storeName: string
    address: string
    printerName: string
    printCopies: number
    autoPrintNewOrders: boolean
    printKitchenTicket: boolean
    printCustomerTicket: boolean
    timeZone?: string
  },
) {
  return {
    storeName:
      settings.storeName,
    address:
      settings.address,
    printerName:
      settings.printerName,
    printCopies:
      settings.printCopies,
    autoPrintNewOrders:
      settings.autoPrintNewOrders,
    printKitchenTicket:
      settings.printKitchenTicket,
    printCustomerTicket:
      settings.printCustomerTicket,
    timeZone:
      settings.timeZone || "America/Sao_Paulo",
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

export async function GET(
  request: Request,
) {
  const context =
    await resolvePrintContext(
      request,
    )

  if (!context) {
    return NextResponse.json(
      {
        error:
          "Agente de impressão não autorizado.",
      },
      { status: 401 },
    )
  }

  if (
    context.mode ===
    "tenant"
  ) {
    const [
      orders,
      settings,
    ] = await Promise.all([
      getTenantUnprintedOrders(
        context.organizationId,
      ),
      getTenantSettings(
        context.organizationId,
      ),
    ])

    if (
      !orders ||
      !settings
    ) {
      return NextResponse.json(
        {
          error:
            "Fila de impressão desta empresa ainda não está pronta.",
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      organization: {
        id:
          context.organizationId,
        name:
          context.organizationName,
        slug:
          context.organizationSlug,
      },
      agent: {
        name:
          context.agentName,
      },
      orders: printOrdersWithLocalTime(
        orders,
        settings.timeZone || "America/Sao_Paulo",
      ),
      settings:
        publicPrintSettings(
          settings,
        ),
    })
  }

  const postgresOrders =
    context.organizationId
      ? await getTenantUnprintedOrders(
          context.organizationId,
        ).catch(
          () => null,
        )
      : null

  const [
    orders,
    settings,
  ] = await Promise.all([
    postgresOrders ??
      getLegacyUnprintedOrders(),
    getLegacySettings(),
  ])

  return NextResponse.json({
    organization: {
      id:
        context.organizationId,
      name:
        settings.storeName,
      slug: "",
    },
    agent: {
      name:
        context.agentName,
    },
    orders: printOrdersWithLocalTime(
      orders,
      settings.timeZone || "America/Fortaleza",
    ),
    settings:
      publicPrintSettings(
        settings,
      ),
  })
}

export async function POST(
  request: Request,
) {
  const context =
    await resolvePrintContext(
      request,
    )

  if (!context) {
    return NextResponse.json(
      {
        error:
          "Agente de impressão não autorizado.",
      },
      { status: 401 },
    )
  }

  const body = (await request
    .json()
    .catch(() => null)) as
    | { orderId?: number }
    | null

  const id =
    Number(body?.orderId)

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Pedido inválido.",
      },
      { status: 400 },
    )
  }

  if (
    context.mode ===
    "tenant"
  ) {
    const order =
      await markTenantOrderPrinted(
        context.organizationId,
        id,
      )

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Pedido não encontrado na empresa deste agente.",
        },
        { status: 404 },
      )
    }

    if (
      await isCurrentDeploymentOrganization(
        context.organizationId,
      )
    ) {
      await syncLegacyOrderFromTenant(
        order,
      )
    }

    return NextResponse.json({
      order,
    })
  }

  if (
    context.organizationId
  ) {
    const postgresOrder =
      await markTenantOrderPrinted(
        context.organizationId,
        id,
      ).catch(
        () => null,
      )

    if (postgresOrder) {
      await syncLegacyOrderFromTenant(
        postgresOrder,
      )

      return NextResponse.json({
        order:
          postgresOrder,
      })
    }
  }

  return NextResponse.json({
    order:
      await markLegacyOrderPrinted(
        id,
      ),
  })
}
