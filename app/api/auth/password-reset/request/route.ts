import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createSelfServicePasswordReset } from "@/lib/admin-user-db"
import {
  authRateLimitKey,
  checkAuthRateLimit,
  registerAuthFailure,
} from "@/lib/security/rate-limit"
import {
  requestIp,
  requestIsSameOrigin,
} from "@/lib/security/request-security"

const IP_LIMIT = 12
const ACCOUNT_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  retryAfterSeconds = 0,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set("Cache-Control", "no-store")

  if (retryAfterSeconds > 0) {
    response.headers.set(
      "Retry-After",
      String(retryAfterSeconds),
    )
  }

  return response
}

function normalizeIdentifier(identifier: string) {
  const trimmed = identifier.trim()

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase()
  }

  return trimmed.replace(/\D/g, "")
}

function genericSuccess() {
  return jsonResponse({
    ok: true,
    message:
      "Se os dados informados estiverem vinculados a uma conta ativa, enviaremos as instruções de recuperação para o e-mail cadastrado.",
  })
}

async function sendPasswordResetEmail(input: {
  recipient: string
  resetUrl: string
  expiresAt: string
}) {
  const apiKey =
    process.env.AUTH_RESEND_API_KEY?.trim() || ""

  const from =
    process.env.AUTH_EMAIL_FROM?.trim() || ""

  if (!apiKey || !from) {
    throw new Error(
      "AUTH_RESEND_API_KEY e AUTH_EMAIL_FROM precisam estar configuradas.",
    )
  }

  const idempotencyKey = createHash("sha256")
    .update(
      `password-reset:${input.recipient}:${input.expiresAt}`,
    )
    .digest("hex")

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key":
          idempotencyKey.slice(0, 250),
        "user-agent": "SaborFlow/Auth",
      },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject:
          "Redefinição de senha - SaborFlow",
        text: [
          "Recebemos uma solicitação para redefinir a senha da sua conta SaborFlow.",
          "",
          "Abra o link abaixo para criar uma nova senha:",
          input.resetUrl,
          "",
          "Este link expira em 30 minutos e pode ser usado uma única vez.",
          "",
          "Se você não solicitou essa alteração, ignore este e-mail.",
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok) {
    const raw = await response.text()

    throw new Error(
      `Falha no envio do e-mail de recuperação (${response.status}): ${raw.slice(0, 300)}`,
    )
  }
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return jsonResponse(
      {
        error:
          "Origem da requisição não autorizada.",
      },
      403,
    )
  }

  const ipKey = authRateLimitKey(
    "ip",
    requestIp(request),
  )

  const ipLimit = checkAuthRateLimit(
    ipKey,
    IP_LIMIT,
    RATE_WINDOW_MS,
  )

  if (!ipLimit.allowed) {
    return jsonResponse(
      {
        error:
          "Muitas solicitações de recuperação. Tente novamente mais tarde.",
      },
      429,
      ipLimit.retryAfterSeconds,
    )
  }

  const body = (await request.json().catch(
    () => null,
  )) as
    | {
        identifier?: string
      }
    | null

  const identifier =
    body?.identifier?.trim() || ""

  if (!identifier) {
    registerAuthFailure(
      ipKey,
      RATE_WINDOW_MS,
    )

    return jsonResponse(
      {
        error:
          "Informe seu CPF ou e-mail.",
      },
      400,
    )
  }

  const normalized =
    normalizeIdentifier(identifier)

  const accountKey = authRateLimitKey(
    "account",
    normalized,
  )

  const accountLimit =
    checkAuthRateLimit(
      accountKey,
      ACCOUNT_LIMIT,
      RATE_WINDOW_MS,
    )

  if (!accountLimit.allowed) {
    return genericSuccess()
  }

  try {
    const reset =
      await createSelfServicePasswordReset(
        identifier,
      )

    if (!reset) {
      registerAuthFailure(
        accountKey,
        RATE_WINDOW_MS,
      )

      return genericSuccess()
    }

    const configuredBaseUrl =
      process.env.APP_BASE_URL?.trim()

    const baseUrl =
      configuredBaseUrl ||
      new URL(request.url).origin

    const resetUrl =
      `${baseUrl.replace(/\/+$/, "")}` +
      `/recuperar-senha/${encodeURIComponent(
        reset.token,
      )}`

    await sendPasswordResetEmail({
      recipient: reset.email,
      resetUrl,
      expiresAt: reset.expiresAt,
    })

    return genericSuccess()
  } catch (error) {
    console.error(
      "[SaborFlow] Falha ao solicitar recuperação de senha:",
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonResponse(
      {
        error:
          "Não foi possível enviar a recuperação de senha no momento.",
      },
      503,
    )
  }
}
