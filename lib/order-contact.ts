import type { Order } from "@/lib/types"

export function whatsappMessageUrl(phone: string, message: string) {
  let number = phone.replace(/\D/g, "")
  if (number.length === 10 || number.length === 11) number = `55${number}`
  if (!/^[1-9]\d{7,14}$/.test(number)) return ""
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function orderStatusMessage(order: Pick<Order, "status" | "type">) {
  switch (order.status) {
    case "pending": return "Seu pedido foi recebido e está aguardando confirmação da loja."
    case "accepted": return "Seu pedido foi aceito pela loja."
    case "preparing": return "Seu pedido está sendo preparado."
    case "ready": return order.type === "pickup" ? "Seu pedido está pronto para retirada na loja." : "Seu pedido está pronto e aguardando saída para entrega."
    case "in-route": return "Seu pedido saiu para entrega e está a caminho!"
    case "completed": return order.type === "delivery" ? "Seu pedido foi marcado como entregue. Obrigado pela preferência!" : "A retirada do seu pedido foi concluída. Obrigado pela preferência!"
    case "cancelled": return "Seu pedido foi cancelado. Entre em contato com a loja se precisar de ajuda."
  }
}

export function whatsappStatusText(order: Order, storeName: string) {
  return [`*${storeName}*`, `Olá, ${order.customer.name}!`, "", `*Pedido ${order.code}*`, orderStatusMessage(order), ...(order.status === "in-route" && order.courierName ? [`Entregador: ${order.courierName}`] : []), "", "Se precisar de algum ajuste ou informação, responda esta mensagem."].join("\n")
}

// Somente links HTTPS configurados pelo administrador da loja.
export function googleReviewLink(value?: string | null) {
  const candidate = String(value || "").trim()
  try {
    const url = new URL(candidate)
    return url.protocol === "https:" && !!url.hostname ? url.toString() : ""
  } catch {
    return ""
  }
}

// O convite abre no WhatsApp para a equipe revisar e enviar;
// nunca envia mensagens automaticamente nem solicita nota positiva.
export function whatsappReviewText(order: Order, storeName: string, reviewUrl?: string | null) {
  const link = googleReviewLink(reviewUrl)
  const completion = order.type === "delivery" ? "entrega" : "retirada"
  return [
    `*${storeName}*`,
    `Olá, ${order.customer.name}!`,
    "",
    `A ${completion} do pedido *${order.code}* foi concluída. Obrigado por comprar conosco!`,
    ...(link ? ["", "Sua opinião é importante. Se quiser contar como foi a sua experiência, você pode nos avaliar no Google:", link] : []),
    "",
    "Agradecemos sua preferência!",
  ].join("\n")
}
