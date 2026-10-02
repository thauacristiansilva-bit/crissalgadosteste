import { authRateLimitKey, checkAuthRateLimit, registerAuthFailure } from "@/lib/security/rate-limit"
import { requestIp } from "@/lib/security/request-security"
import { InputValidationError } from "@/lib/security/input-validation"

export async function limitDeliveryRequests(request: Request, userId: string) {
  for (const [scope,value,limit] of [["account",userId,15],["ip",requestIp(request),40]] as const) {
    const key = authRateLimitKey(scope, `mfa-delivery:${value}`)
    const state = await checkAuthRateLimit(key,limit,10*60_000)
    if (!state.allowed) throw new InputValidationError("Muitas solicitações. Aguarde alguns minutos e tente novamente.",429)
    await registerAuthFailure(key,10*60_000)
  }
}
