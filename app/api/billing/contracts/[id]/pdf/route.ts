import { NextResponse } from "next/server"
import { getBillingIdentity } from "@/lib/billing-identity"
import { getSignedContractPdfForUser } from "@/lib/contract-signing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getBillingIdentity()
  if (!identity) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await context.params
  const contract = await getSignedContractPdfForUser(id, identity.userId)
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
  return new Response(new Uint8Array(contract.signed_pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Contrato-SaborFlow-${id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Contract-SHA256": contract.pdf_sha256,
    },
  })
}
