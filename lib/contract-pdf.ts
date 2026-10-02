import { createHash } from "node:crypto"
import { EARLY_TERMINATION_PENALTY_PERCENT, SABORFLOW_FIXED_PRICING } from "@/lib/commercial-contract"
import { PRIVACY_VERSION, SUBSCRIPTION_CONTRACT_VERSION, TERMS_VERSION } from "@/lib/legal-documents"
import type { BillingCycle, PaymentMethod } from "@/lib/billing-types"

type ContractPdfInput = {
  contractId: string
  signerName: string
  signerEmail: string
  signerCpfMasked: string
  planCode: string
  planName: string
  billingCycle: BillingCycle
  paymentMethod: PaymentMethod
  contractValueCents: number
  recurringAmountCents: number
  commitmentMonths: number
  signedAtIso: string
  ipAddress?: string | null
  userAgent?: string | null
  signatureJpeg: Buffer
  signatureWidth: number
  signatureHeight: number
}

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function cycleLabel(cycle: BillingCycle) {
  if (cycle === "annual") return "Anual"
  if (cycle === "semiannual") return "Semestral"
  return "Mensal"
}

function paymentLabel(method: PaymentMethod) {
  if (method === "credit_card") return "Cartao de credito"
  if (method === "boleto") return "Boleto"
  return "Pix"
}

function pdfText(value: string) {
  const normalized = value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x00-\xFF]/g, "?")
  let out = ""
  for (const ch of normalized) {
    const code = ch.charCodeAt(0)
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`
    else if (code < 32 && ch !== "\t") out += " "
    else out += ch
  }
  return out
}

function wrap(text: string, max = 92) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > max && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function jpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("Assinatura JPEG invalida.")
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue }
    const marker = buffer[offset + 1]
    offset += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    if (offset + 2 > buffer.length) break
    const length = buffer.readUInt16BE(offset)
    if (length < 2 || offset + length > buffer.length) break
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      const height = buffer.readUInt16BE(offset + 3)
      const width = buffer.readUInt16BE(offset + 5)
      return { width, height }
    }
    offset += length
  }
  throw new Error("Nao foi possivel ler as dimensoes da assinatura.")
}

export function parseSignatureJpegDataUrl(dataUrl: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim())
  if (!match) throw new Error("Assinatura invalida. Assine novamente no quadro.")
  const buffer = Buffer.from(match[1], "base64")
  if (buffer.length < 500 || buffer.length > 500_000) throw new Error("Assinatura fora do tamanho permitido.")
  const dimensions = jpegDimensions(buffer)
  return { buffer, ...dimensions, sha256: createHash("sha256").update(buffer).digest("hex") }
}

function contractParagraphs(input: ContractPdfInput) {
  const fixed = SABORFLOW_FIXED_PRICING[input.billingCycle]
  const earlyClause = input.billingCycle === "monthly"
    ? "O plano mensal nao possui multa de fidelidade para impedir renovacoes futuras, permanecendo devidos valores ja vencidos ou do periodo ja contratado."
    : `O plano ${cycleLabel(input.billingCycle).toLowerCase()} possui permanencia minima de ${input.commitmentMonths} meses. Em caso de rescisao antecipada, podera ser aplicada multa de ${EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo das mensalidades vincendas, observados os limites legais e as hipoteses de isencao previstas em lei.`

  return [
    ["1. Objeto e licenca de uso", "O presente Contrato de Licenca e Assinatura disciplina a contratacao do SaborFlow, software de gestao disponibilizado como servico, mediante licenca de uso nao exclusiva, temporaria e limitada a conta e aos recursos contratados."],
    ["2. Conta, teste gratis e continuidade", "Quando houver teste gratis, a mesma conta da empresa sera preservada. Se a contratacao ocorrer antes do fim do teste, os dias gratuitos restantes poderao ser mantidos conforme a oferta vigente, e o plano pago sera ativado de acordo com a confirmacao financeira do provedor."],
    ["3. Plano e valores", `Plano contratado: ${input.planName} (${input.planCode}). Periodo: ${cycleLabel(input.billingCycle)}. Valor mensal de referencia: ${brl(input.recurringAmountCents)}. Valor contratual do periodo: ${brl(input.contractValueCents)}. Forma de pagamento escolhida: ${paymentLabel(input.paymentMethod)}.`],
    ["4. Permanencia e cancelamento", earlyClause],
    ["5. Pagamento e ativacao", "A criacao do checkout, Pix, boleto ou tentativa de cartao nao equivale a pagamento aprovado. A ativacao comercial depende da confirmacao recebida do provedor de pagamento integrado."],
    ["6. Inteligencia artificial e adicionais", "Recursos de inteligencia artificial, importacao assistida e outros servicos adicionais podem possuir preco, prazo, franquia e limites proprios e nao estao automaticamente incluidos no plano principal, salvo quando expressamente informado."],
    ["7. Termos e privacidade", `Este contrato e complementar aos Termos de Uso versao ${TERMS_VERSION} e ao Aviso de Privacidade versao ${PRIVACY_VERSION}. Direitos inderrogaveis previstos em lei prevalecem sobre disposicoes contratuais incompatíveis.`],
    ["8. Legislacao aplicavel", "O contrato e regido pela legislacao brasileira. Clausulas de penalidade, permanencia, reembolso e cancelamento serao aplicadas de forma proporcional e nos limites legalmente admitidos."],
    ["9. Manifestacao eletronica de vontade", "O contratante declara que leu o contrato e os documentos vinculados, escolheu o plano e a forma de pagamento e realizou a assinatura eletronicamente no ambiente autenticado do SaborFlow. A trilha de auditoria e o resumo criptografico do documento sao preservados para demonstrar autoria e integridade."],
    ["10. Resumo comercial", `Referencia fixa do ciclo: ${cycleLabel(input.billingCycle)} - ${fixed.commitmentMonths} mes(es). Contrato assinado antes do redirecionamento ao pagamento.`],
  ] as const
}

type PageBuilder = { commands: string[]; y: number; hasSignature: boolean; signatureY?: number }

function newPage(): PageBuilder { return { commands: [], y: 790, hasSignature: false } }

function addLine(page: PageBuilder, text: string, opts?: { bold?: boolean; size?: number; gap?: number }) {
  const size = opts?.size ?? 10
  const font = opts?.bold ? "/F2" : "/F1"
  page.commands.push(`BT ${font} ${size} Tf 50 ${page.y} Td (${pdfText(text)}) Tj ET`)
  page.y -= opts?.gap ?? (size + 5)
}

function addWrapped(pages: PageBuilder[], text: string, opts?: { bold?: boolean; size?: number; after?: number }) {
  for (const line of wrap(text, opts?.bold ? 76 : 92)) {
    let page = pages[pages.length - 1]
    if (page.y < 90) { pages.push(newPage()); page = pages[pages.length - 1] }
    addLine(page, line, { bold: opts?.bold, size: opts?.size })
  }
  pages[pages.length - 1].y -= opts?.after ?? 8
}

export function buildSignedContractPdf(input: ContractPdfInput) {
  const pages: PageBuilder[] = [newPage()]
  addLine(pages[0], "SABORFLOW", { bold: true, size: 18, gap: 24 })
  addLine(pages[0], "CONTRATO DE LICENCA E ASSINATURA", { bold: true, size: 16, gap: 24 })
  addWrapped(pages, `Versao do contrato: ${SUBSCRIPTION_CONTRACT_VERSION} | ID: ${input.contractId}`, { size: 9, after: 12 })
  addWrapped(pages, `Contratante: ${input.signerName} | E-mail: ${input.signerEmail} | CPF: ${input.signerCpfMasked}`, { after: 12 })
  addWrapped(pages, `Assinado em: ${new Date(input.signedAtIso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`, { after: 16 })

  for (const [title, body] of contractParagraphs(input)) {
    addWrapped(pages, title, { bold: true, size: 11, after: 3 })
    addWrapped(pages, body, { size: 10, after: 12 })
  }

  let last = pages[pages.length - 1]
  if (last.y < 260) { pages.push(newPage()); last = pages[pages.length - 1] }
  addLine(last, "ASSINATURA ELETRONICA DO CONTRATANTE", { bold: true, size: 11, gap: 20 })
  last.hasSignature = true
  last.signatureY = last.y - 95
  last.y -= 125
  addWrapped(pages, `Nome: ${input.signerName}`, { size: 9, after: 2 })
  addWrapped(pages, `E-mail: ${input.signerEmail} | CPF: ${input.signerCpfMasked}`, { size: 9, after: 2 })
  addWrapped(pages, `IP registrado: ${input.ipAddress || "nao informado"}`, { size: 8, after: 2 })
  addWrapped(pages, `Navegador/dispositivo: ${(input.userAgent || "nao informado").slice(0, 150)}`, { size: 8, after: 2 })
  addWrapped(pages, "O hash SHA-256 do PDF e armazenado no SaborFlow para verificacao de integridade.", { size: 8, after: 2 })

  const objects: Buffer[] = []
  const addObj = (content: Buffer | string) => { objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, "binary")); return objects.length }

  const fontRegular = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
  const fontBold = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
  const imageObj = addObj(Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${input.signatureWidth} /Height ${input.signatureHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.signatureJpeg.length} >>\nstream\n`, "binary"),
    input.signatureJpeg,
    Buffer.from("\nendstream", "binary"),
  ]))

  const pageContentObjs: number[] = []
  for (const page of pages) {
    const commands = [...page.commands]
    if (page.hasSignature) {
      const ratio = input.signatureHeight / Math.max(1, input.signatureWidth)
      const width = 220
      const height = Math.min(100, Math.max(55, width * ratio))
      const signatureY = page.signatureY ?? 120
      commands.push(`q ${width} 0 0 ${height} 50 ${signatureY} cm /Im1 Do Q`)
      commands.push(`0.7 G 50 ${signatureY - 5} m 270 ${signatureY - 5} l S`)
    }
    const stream = Buffer.from(commands.join("\n"), "binary")
    pageContentObjs.push(addObj(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "binary"),
      stream,
      Buffer.from("\nendstream", "binary"),
    ])))
  }

  const pageObjIds: number[] = []
  // Placeholder Pages object; references are resolved after page objects are added.
  const pagesObjId = addObj("__PAGES_PLACEHOLDER__")
  for (let i = 0; i < pages.length; i++) {
    const resources = `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> /XObject << /Im1 ${imageObj} 0 R >> >>`
    pageObjIds.push(addObj(`<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents ${pageContentObjs[i]} 0 R >>`))
  }
  objects[pagesObjId - 1] = Buffer.from(`<< /Type /Pages /Count ${pageObjIds.length} /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] >>`, "binary")
  const catalogObj = addObj(`<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`)

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")]
  const offsets = [0]
  let cursor = chunks[0].length
  for (let i = 0; i < objects.length; i++) {
    offsets.push(cursor)
    const header = Buffer.from(`${i + 1} 0 obj\n`, "binary")
    const footer = Buffer.from("\nendobj\n", "binary")
    chunks.push(header, objects[i], footer)
    cursor += header.length + objects[i].length + footer.length
  }
  const xrefOffset = cursor
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  const trailer = `${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(trailer, "binary"))
  return Buffer.concat(chunks)
}
