"use client"
import type { Order, StoreSettings } from "@/lib/types"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char))

export function orderTicketHtml(order: Order, settings?: Pick<StoreSettings, "storeName" | "address">, mode: "kitchen" | "customer" = "customer") {
  const items = order.items.map((item) => {
    const modifiers = (item.modifiers || []).map((modifier) => `<div class="small">&nbsp;&nbsp;+ ${escapeHtml(modifier.optionName)}${mode === "customer" && !modifier.included && modifier.priceDelta > 0 ? ` (+${money(modifier.priceDelta)})` : ""}</div>`).join("")
    return `<tr><td>${item.quantity}x ${escapeHtml(item.name)}${modifiers}</td><td style="text-align:right">${mode === "customer" ? money(item.subtotal) : ""}</td></tr>`
  }).join("")
  const receive = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.requestedFor))
  return `<!doctype html><html><head><meta charset="utf-8"><title>${order.code}</title><style>@page{size:80mm auto;margin:3mm}body{font:14px ui-monospace,Consolas,monospace;margin:0;color:#000}.c{text-align:center}.b{font-weight:800}.big{font-size:22px}hr{border:0;border-top:1px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}.small{font-size:11px}.warn{font-size:17px;font-weight:900;border:2px solid #000;padding:5px;text-align:center;margin:7px 0}</style></head><body><div class="c b">${escapeHtml(settings?.storeName || "Cris Salgados")}</div><div class="c big b">${order.code}</div><div class="c small">${escapeHtml(order.reference)}</div><hr/><div class="warn">RECEBER: ${receive}</div><div><span class="b">${order.type === "delivery" ? "DELIVERY" : "RETIRADA"}</span> · ${order.scheduled ? "AGENDADO" : "IMEDIATO"}</div><div class="b">Cliente: ${escapeHtml(order.customer.name)}</div>${order.type === "delivery" ? `<div>${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.number || "")}${order.customer.district ? ` - ${escapeHtml(order.customer.district)}` : ""}</div>` : ""}<hr/><table>${items}</table>${order.notes ? `<hr/><div class="b">OBS: ${escapeHtml(order.notes)}</div>` : ""}${mode === "customer" ? `<hr/><table><tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr>${order.discount ? `<tr><td>Desconto</td><td style="text-align:right">-${money(order.discount)}</td></tr>` : ""}${order.deliveryFee ? `<tr><td>Entrega</td><td style="text-align:right">${money(order.deliveryFee)}</td></tr>` : ""}<tr class="b"><td>TOTAL</td><td style="text-align:right">${money(order.total)}</td></tr></table><div>Pagamento: ${order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "DINHEIRO" : "CARTÃO"}</div>` : ""}<hr/><div class="c small">${escapeHtml(settings?.address || "")}</div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`
}

export function printOrder(order: Order, settings?: Pick<StoreSettings, "storeName" | "address">, mode: "kitchen" | "customer" = "customer") {
  const popup = window.open("", "_blank", "width=480,height=800")
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.")
  popup.document.open()
  popup.document.write(orderTicketHtml(order, settings, mode))
  popup.document.close()
}
