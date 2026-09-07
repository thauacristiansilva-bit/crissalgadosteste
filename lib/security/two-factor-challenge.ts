import {
  createHmac,
  timingSafeEqual,
} from "node:crypto"

export const TWO_FACTOR_CHALLENGE_COOKIE =
  "saborflow_2fa_challenge"

export type TwoFactorChallengeMode =
  | "setup"
  | "verify"

export type TwoFactorAuthSource =
  | "cpf"
  | "email"
  | "google"

export type TwoFactorChallenge = {
  v: 1
  purpose: "admin-2fa"
  userId: string
  email: string
  authSource: TwoFactorAuthSource
  allowSuperadmin: boolean
  mode: TwoFactorChallengeMode
  expiresAt: number
}

const CHALLENGE_TTL_MS = 10 * 60 * 1000

function getSessionSecret() {
  const configured =
    process.env.SESSION_SECRET?.trim()

  if (!configured) {
    throw new Error(
      "SESSION_SECRET é obrigatório para o desafio 2FA.",
    )
  }

  return configured
}

function sign(value: string) {
  return createHmac(
    "sha256",
    getSessionSecret(),
  )
    .update(value)
    .digest("base64url")
}

function signaturesMatch(
  actual: string,
  expected: string,
) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    return false
  }

  return timingSafeEqual(
    actualBuffer,
    expectedBuffer,
  )
}

export function createTwoFactorChallenge(
  input: Omit<
    TwoFactorChallenge,
    "v" | "purpose" | "expiresAt"
  >,
) {
  const payload: TwoFactorChallenge = {
    v: 1,
    purpose: "admin-2fa",
    userId: input.userId.trim(),
    email: input.email.trim().toLowerCase(),
    authSource: input.authSource,
    allowSuperadmin:
      Boolean(input.allowSuperadmin),
    mode: input.mode,
    expiresAt:
      Date.now() + CHALLENGE_TTL_MS,
  }

  const encoded = Buffer.from(
    JSON.stringify(payload),
  ).toString("base64url")

  const signature = sign(
    `admin-2fa:${encoded}`,
  )

  return `mfa1.${encoded}.${signature}`
}

export function parseTwoFactorChallenge(
  token?: string | null,
): TwoFactorChallenge | null {
  if (
    !token ||
    !token.startsWith("mfa1.")
  ) {
    return null
  }

  const parts = token.split(".")

  if (parts.length !== 3) {
    return null
  }

  const [, encoded, signature] = parts

  if (!encoded || !signature) {
    return null
  }

  const expected = sign(
    `admin-2fa:${encoded}`,
  )

  if (
    !signaturesMatch(
      signature,
      expected,
    )
  ) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(
        encoded,
        "base64url",
      ).toString("utf8"),
    ) as Partial<TwoFactorChallenge>

    if (
      payload.v !== 1 ||
      payload.purpose !== "admin-2fa" ||
      !payload.userId ||
      !payload.email ||
      !payload.authSource ||
      !["cpf", "email", "google"].includes(
        payload.authSource,
      ) ||
      !payload.mode ||
      !["setup", "verify"].includes(
        payload.mode,
      ) ||
      !payload.expiresAt ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return {
      v: 1,
      purpose: "admin-2fa",
      userId: payload.userId,
      email: payload.email,
      authSource:
        payload.authSource as TwoFactorAuthSource,
      allowSuperadmin:
        Boolean(payload.allowSuperadmin),
      mode:
        payload.mode as TwoFactorChallengeMode,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function twoFactorChallengeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
    maxAge: Math.floor(
      CHALLENGE_TTL_MS / 1000,
    ),
    priority: "high" as const,
  }
}

export function clearTwoFactorChallengeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
    maxAge: 0,
  }
}
