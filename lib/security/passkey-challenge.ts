import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto"

export const PASSKEY_CHALLENGE_COOKIE =
  "saborflow_passkey_challenge"

const PASSKEY_CHALLENGE_TTL_SECONDS =
  10 * 60

type PasskeyChallengePurpose =
  | "registration"
  | "authentication"

export type PasskeyChallenge = {
  v: 1
  purpose: PasskeyChallengePurpose
  userId: string
  challenge: string
  rpID: string
  expectedOrigin: string
  name?: string
  parentChallengeHash?: string
  expiresAt: number
}

function sessionSecret() {
  const value =
    process.env.SESSION_SECRET?.trim()

  if (!value) {
    throw new Error(
      "SESSION_SECRET é obrigatório para Passkeys.",
    )
  }

  return value
}

function sign(value: string) {
  return createHmac(
    "sha256",
    sessionSecret(),
  )
    .update(
      `saborflow:passkey-challenge:v1:${value}`,
    )
    .digest("base64url")
}

function safeEqual(
  actual: string,
  expected: string,
) {
  const left =
    Buffer.from(actual)
  const right =
    Buffer.from(expected)

  return (
    left.length === right.length &&
    timingSafeEqual(
      left,
      right,
    )
  )
}

export function createPasskeyChallenge(
  input: Omit<
    PasskeyChallenge,
    "v" | "expiresAt"
  >,
) {
  const payload: PasskeyChallenge = {
    v: 1,
    ...input,
    expiresAt:
      Date.now() +
      PASSKEY_CHALLENGE_TTL_SECONDS *
        1000,
  }

  const encoded =
    Buffer.from(
      JSON.stringify(payload),
    ).toString("base64url")

  return `pk1.${encoded}.${sign(encoded)}`
}

export function parsePasskeyChallenge(
  token?: string | null,
) {
  if (
    !token ||
    !token.startsWith("pk1.")
  ) {
    return null
  }

  const parts =
    token.split(".")

  if (parts.length !== 3) {
    return null
  }

  const [
    ,
    encoded,
    signature,
  ] = parts

  if (
    !encoded ||
    !signature ||
    !safeEqual(
      signature,
      sign(encoded),
    )
  ) {
    return null
  }

  try {
    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url",
        ).toString("utf8"),
      ) as Partial<PasskeyChallenge>

    if (
      payload.v !== 1 ||
      ![
        "registration",
        "authentication",
      ].includes(
        String(payload.purpose),
      ) ||
      !payload.userId ||
      !payload.challenge ||
      !payload.rpID ||
      !payload.expectedOrigin ||
      !payload.expiresAt ||
      payload.expiresAt <=
        Date.now()
    ) {
      return null
    }

    return {
      v: 1 as const,
      purpose:
        payload.purpose as
          PasskeyChallengePurpose,
      userId:
        payload.userId,
      challenge:
        payload.challenge,
      rpID:
        payload.rpID,
      expectedOrigin:
        payload.expectedOrigin,
      name:
        payload.name,
      parentChallengeHash:
        payload.parentChallengeHash,
      expiresAt:
        payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function passkeyParentChallengeHash(
  token: string,
) {
  return createHash("sha256")
    .update(
      `saborflow:2fa-parent:v1:${token}`,
    )
    .digest("base64url")
}

export function passkeyChallengeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
    maxAge:
      PASSKEY_CHALLENGE_TTL_SECONDS,
    priority: "high" as const,
  }
}

export function clearPasskeyChallengeCookieOptions() {
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
