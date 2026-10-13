import type { Order, OrderItemModifier } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export function modifierLine(modifier: OrderItemModifier, showPrice = true) {
  return `${modifier.groupName}: ${modifier.optionName}${showPrice && !modifier.included && modifier.priceDelta > 0 ? ` (+${money(modifier.priceDelta)})` : modifier.included ? " (incluído)" : ""}`
}

function dateLabel(value: string, timeZone: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Não informado"
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(date) }
  catch { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date) }
}

function modifierLines(modifiers: OrderItemModifier[]) {
  const rows = new Map<string, { modifier: OrderItemModifier; count: number }>()
  for (const modifier of modifiers) {
    const key = JSON.stringify([modifier.groupId, modifier.optionId, modifier.groupName, modifier.optionName, modifier.priceDelta, modifier.included])
    const row = rows.get(key)
    if (row) row.count += 1
    else rows.set(key, { modifier, count: 1 })
  }
  return [...rows.values()].map(({ modifier, count }) => `  • ${count > 1 ? `${count}x ` : ""}${modifierLine(modifier)}`)
}

export function whatsappOrderText(order: Order, storeName: string, timeZone = "America/Sao_Paulo") {
  const items = order.items.map((item) => [
    `*${item.quantity}x ${item.name}*`,
    `  Valor dos itens: ${money(item.subtotal)}`,
    ...modifierLines(item.modifiers || []),
  ].join("\n")).join("\n\n")
  const customer = order.customer
  const delivery = order.type === "delivery"
  const address = [customer.address, customer.number, customer.complement, customer.district, [customer.city, customer.state].filter(Boolean).join(" / "), customer.zipCode ? `CEP ${customer.zipCode}` : ""].filter(Boolean).join(", ")
  const payment = order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"
  // Os totais são os valores já calculados e salvos pelo servidor.
  const cashback = order.cashbackUsed ?? order.cashbackDiscount ?? 0
  return [
    `*${storeName.trim() || "Loja"}*`,
    `*PEDIDO ${order.code}*`,
    `Referência: ${order.reference}`,
    `Realizado em: ${dateLabel(order.createdAt, timeZone)}`,
    "",
    "*CLIENTE*",
    `Nome: ${customer.name}`,
    ...(customer.phone ? [`WhatsApp: ${customer.phone}`] : []),
    "",
    `*${delivery ? "ENTREGA" : "RETIRADA NA LOJA"}*`,
    `${order.scheduled ? "Data e horário agendados" : "Previsão de recebimento"}: ${dateLabel(order.requestedFor, timeZone)}`,
    ...(delivery ? [`Endereço: ${address || "Não informado"}`] : []),
    "",
    "*PRODUTOS E ESCOLHAS*",
    items,
    "",
    "*VALORES*",
    `Subtotal: ${money(order.subtotal)}`,
    ...(order.discount ? [`Desconto${order.couponCode ? ` (${order.couponCode})` : ""}: -${money(order.discount)}`] : []),
    ...(delivery ? [`Taxa de entrega: ${money(order.deliveryFee)}`] : []),
    ...(cashback ? [`Cashback utilizado: -${money(cashback)}`] : []),
    `*TOTAL DO PEDIDO: ${money(order.total)}*`,
    "",
    "*PAGAMENTO*",
    `Forma: ${payment}`,
    `Situação: ${order.paymentStatus === "paid" ? "Pago" : "Pendente"}`,
    ...(order.paymentMethod === "cash" && order.changeFor ? [`Troco para: ${order.changeFor}`] : []),
    ...(order.notes?.trim() ? ["", "*OBSERVAÇÕES*", order.notes.trim()] : []),
  ].join("\n")
}
