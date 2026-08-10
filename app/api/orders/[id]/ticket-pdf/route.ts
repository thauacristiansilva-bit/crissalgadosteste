import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getOrderById, getSettings } from "@/lib/db"

const money = (value: number) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`
const stamp = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value))
function ascii(text: string) { return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim() }
function escapePdf(text: string) { return ascii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") }
function wrap(text: string, limit = 36) { const words = ascii(text).split(" ").filter(Boolean); const lines: string[] = []; let line = ""; for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > limit && line) { lines.push(line); line = word } else line = next } if (line) lines.push(line); return lines.length ? lines : [""] }
function pdfDocument(lines: Array<{ text: string; bold?: boolean; size?: number }>) {
  const width = 226.77
  const lineHeight = 13
  const height = Math.max(520, 60 + lines.reduce((sum, line) => sum + wrap(line.text).length * lineHeight, 0))
  let y = height - 24
  const commands: string[] = []
  for (const row of lines) {
    const font = row.bold ? "/F2" : "/F1"; const size = row.size || 9
    for (const line of wrap(row.text, 38)) {
      commands.push(`BT ${font} ${size} Tf 14 ${y.toFixed(2)} Td (${escapePdf(line)}) Tj ET`)
      y -= Math.max(lineHeight, size + 4)
    }
  }
  const stream = commands.join("\n")
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "ascii")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, "ascii")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "ascii")
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const order = await getOrderById(Number(id))
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  const settings = await getSettings()
  const mode = new URL(request.url).searchParams.get("mode") === "kitchen" ? "kitchen" : "customer"
  const lines: Array<{ text: string; bold?: boolean; size?: number }> = [
    { text: settings.storeName.toUpperCase(), bold: true, size: 12 },
    { text: order.code, bold: true, size: 18 },
    { text: order.reference, size: 7 },
    { text: "--------------------------------------" },
    { text: `RECEBER: ${stamp(order.requestedFor)}`, bold: true, size: 11 },
    { text: `${order.type === "delivery" ? "DELIVERY" : "RETIRADA"} - ${order.scheduled ? "AGENDADO" : "IMEDIATO"}`, bold: true },
    { text: `Cliente: ${order.customer.name}` },
  ]
  if (order.customer.phone) lines.push({ text: `Telefone: ${order.customer.phone}` })
  if (order.type === "delivery") {
    lines.push({ text: `Endereco: ${order.customer.address}, ${order.customer.number || "s/n"}` })
    if (order.customer.district) lines.push({ text: `Bairro: ${order.customer.district}` })
    if (order.deliveryZoneName) lines.push({ text: `Area: ${order.deliveryZoneName}` })
    if (order.courierName) lines.push({ text: `Entregador: ${order.courierName}` })
  }
  lines.push({ text: "--------------------------------------" })
  order.items.forEach((item) => lines.push({ text: `${item.quantity}x ${item.name}${mode === "customer" ? `  ${money(item.subtotal)}` : ""}`, bold: mode === "kitchen" }))
  if (order.notes) lines.push({ text: "--------------------------------------" }, { text: `OBS: ${order.notes}`, bold: true })
  if (mode === "customer") {
    lines.push({ text: "--------------------------------------" }, { text: `Subtotal: ${money(order.subtotal)}` })
    if (order.discount > 0) lines.push({ text: `Desconto: -${money(order.discount)}` })
    if (order.deliveryFee > 0) lines.push({ text: `Entrega: ${money(order.deliveryFee)}` })
    lines.push({ text: `TOTAL: ${money(order.total)}`, bold: true, size: 12 }, { text: `Pagamento: ${order.paymentMethod === "pix" ? "PIX" : order.paymentMethod === "cash" ? "DINHEIRO" : "CARTAO"}` })
  }
  lines.push({ text: "--------------------------------------" })
  if (settings.address) lines.push({ text: settings.address, size: 7 })
  lines.push({ text: "Gerado pelo sistema", size: 6 })
  return new NextResponse(pdfDocument(lines), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=pedido-${order.code.replace("#", "")}-${mode}.pdf`, "Cache-Control": "no-store" } })
}
