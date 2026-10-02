import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { parseTwoFactorChallenge, TWO_FACTOR_CHALLENGE_COOKIE } from "@/lib/security/two-factor-challenge"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { readJsonObject, InputValidationError } from "@/lib/security/input-validation"
import { deliveryChannel } from "@/lib/security/delivery-code-crypto"
import { deliveryContacts, sendDeliveryCode } from "@/lib/security/delivery-codes"
import { limitDeliveryRequests } from "@/lib/security/delivery-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const json = (body: unknown, status=200) => NextResponse.json(body,{ status, headers:{ "Cache-Control":"no-store" } })
async function context() {
  const store = await cookies()
  const token = store.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value || ""
  const challenge = parseTwoFactorChallenge(token)
  return challenge?.mode === "verify" ? { token, challenge } : null
}

export async function GET() {
  const current = await context()
  if (!current) return json({ channels:[] })
  try { const status = await deliveryContacts(current.challenge.userId); return json({ channels:status.channels.filter((channel) => channel.enrolled && channel.configured) }) }
  catch { return json({ channels:[] }) }
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return json({ error:"Origem não autorizada." },403)
  const current = await context()
  if (!current) return json({ error:"Sua verificação expirou. Entre novamente." },401)
  try {
    await limitDeliveryRequests(request,current.challenge.userId)
    const body = await readJsonObject(request,1024)
    const channel = deliveryChannel(body?.channel)
    const sent = await sendDeliveryCode({ userId:current.challenge.userId,channel,purpose:"login",binding:current.token })
    return json({ ok:true,...sent })
  } catch (error) {
    return json({ error:error instanceof InputValidationError || (error instanceof Error && !("code" in error)) ? error.message : "Não foi possível enviar o código. Tente novamente ou use o autenticador." }, error instanceof InputValidationError ? error.status : 400)
  }
}
