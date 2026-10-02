import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { readJsonObject, InputValidationError } from "@/lib/security/input-validation"
import { verifySecondFactor } from "@/lib/security/two-factor"
import { deliveryChannel, normalizeDeliveryPhone } from "@/lib/security/delivery-code-crypto"
import { consumeDeliveryCode, deliveryContacts, removeDeliveryContact, sendDeliveryCode } from "@/lib/security/delivery-codes"
import { limitDeliveryRequests } from "@/lib/security/delivery-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const json = (body: unknown, status=200) => NextResponse.json(body,{ status, headers:{ "Cache-Control":"no-store" } })

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) return json({ error:"Faça login no painel." },401)
  try { const status = await deliveryContacts(session.userId); return json({ channels:status.channels }) }
  catch { return json({ error:"O envio de códigos ainda precisa ser instalado no servidor." },503) }
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return json({ error:"Origem não autorizada." },403)
  const session = await getVerifiedTenantSession()
  if (!session) return json({ error:"Faça login no painel." },401)
  try {
    await limitDeliveryRequests(request,session.userId)
    const body = await readJsonObject(request,4096)
    if (!body) throw new InputValidationError("Informe os dados.")
    const binding = `enroll:${session.sessionId}`
    if (body.action === "verify") {
      if (typeof body.id !== "string" || typeof body.code !== "string") throw new InputValidationError("Informe o código recebido.")
      if (!await consumeDeliveryCode({ userId:session.userId,id:body.id,code:body.code.trim(),purpose:"enroll",binding })) return json({ error:"Código inválido, expirado ou já utilizado. Confira o código ou solicite outro." },401)
      return json({ ok:true, channels:(await deliveryContacts(session.userId)).channels })
    }
    if (body.action !== "send" && body.action !== "remove") throw new InputValidationError("Ação inválida.")
    const channel = deliveryChannel(body.channel)
    const phone = channel === "sms" && body.action === "send" ? normalizeDeliveryPhone(body.phone) : undefined
    if (typeof body.verifier !== "string" || body.verifier.length > 40 || !await verifySecondFactor(session.userId,body.verifier)) return json({ error:"Informe um código atual do autenticador ou um código de recuperação. Se acabou de usar o código, aguarde o próximo." },401)
    if (body.action === "remove") {
      await removeDeliveryContact(session.userId,channel)
      return json({ ok:true, channels:(await deliveryContacts(session.userId)).channels })
    }
    const sent = await sendDeliveryCode({ userId:session.userId,channel,purpose:"enroll",binding,phone })
    return json({ ok:true,...sent })
  } catch (error) {
    return json({ error:error instanceof InputValidationError || (error instanceof Error && !("code" in error)) ? error.message : "Não foi possível configurar o envio. Confira a atualização do servidor." }, error instanceof InputValidationError ? error.status : 400)
  }
}
