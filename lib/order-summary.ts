import type { Order, OrderItemModifier } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export function modifierLine(modifier: OrderItemModifier, showPrice = true) {
  return `${modifier.groupName}: ${modifier.optionName}${showPrice && !modifier.included && modifier.priceDelta > 0 ? ` (+${money(modifier.priceDelta)})` : ""}`
}

export function whatsappOrderText(order: Order, storeName: string, timeZone = "America/Sao_Paulo") {
  const receive = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(order.requestedFor))
  const items = order.items.map((item) => [
    `*${item.quantity}x ${item.name}* — ${money(item.subtotal)}`,
    ...(item.modifiers || []).map((modifier) => `  • ${modifierLine(modifier)}`),
  ].join("\n")).join("\n\n")
  const address = order.type === "delivery" ? [order.customer.address, order.customer.number, order.customer.complement, order.customer.district, order.customer.city].filter(Boolean).join(", ") : "Retirada na loja"
  return [
    `*${storeName} — Pedido ${order.code}*`,
    `Referência: ${order.reference}`,
    `Cliente: ${order.customer.name}${order.customer.phone ? ` (${order.customer.phone})` : ""}`,
    `${order.type === "delivery" ? "Entrega" : "Retirada"} ${order.scheduled ? "agendada" : "imediata"}: ${receive}`,
    `Local: ${address}`,
    "*Itens:*", items,
    `Subtotal: ${money(order.subtotal)}`,
    ...(order.discount ? [`Desconto${order.couponCode ? ` (${order.couponCode})` : ""}: -${money(order.discount)}`] : []),
    ...(order.deliveryFee ? [`Entrega: ${money(order.deliveryFee)}`] : []),
    ...(order.cashbackUsed ? [`Cashback utilizado: -${money(order.cashbackUsed)}`] : []),
    `*Total: ${money(order.total)}*`,
    `Pagamento: ${order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "dinheiro" : "cartão"}${order.changeFor ? ` (troco para ${order.changeFor})` : ""}`,
    ...(order.notes ? [`Observações: ${order.notes}`] : []),
  ].join("\n")
}
