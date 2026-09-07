import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"

const BASE32_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6
const TOTP_WINDOW = 1
const RECOVERY_CODE_COUNT = 10

type MfaRow = {
  user_id: string
  secret_encrypted: string
  enabled: boolean
  last_totp_step: string | null
  recovery_code_hashes: unknown
}

function getEncryptionKey() {
  const configured =
    process.env
      .TWO_FACTOR_ENCRYPTION_KEY
      ?.trim()

  if (!configured) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY é obrigatório para o 2FA.",
    )
  }

  const key = Buffer.from(
    configured,
    "base64url",
  )

  if (key.length !== 32) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY deve conter exatamente 32 bytes em base64url.",
    )
  }

  return key
}

function base32Encode(input: Buffer) {
  let bits = ""
  let output = ""

  for (const byte of input) {
    bits += byte
      .toString(2)
      .padStart(8, "0")
  }

  for (
    let index = 0;
    index < bits.length;
    index += 5
  ) {
    const chunk = bits
      .slice(index, index + 5)
      .padEnd(5, "0")

    output +=
      BASE32_ALPHABET[
        Number.parseInt(chunk, 2)
      ]
  }

  return output
}

function base32Decode(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "")

  let bits = ""

  for (const character of normalized) {
    const index =
      BASE32_ALPHABET.indexOf(
        character,
      )

    if (index < 0) {
      throw new Error(
        "Segredo TOTP inválido.",
      )
    }

    bits += index
      .toString(2)
      .padStart(5, "0")
  }

  const bytes: number[] = []

  for (
    let index = 0;
    index + 8 <= bits.length;
    index += 8
  ) {
    bytes.push(
      Number.parseInt(
        bits.slice(index, index + 8),
        2,
      ),
    )
  }

  return Buffer.from(bytes)
}

function aadForUser(userId: string) {
  return Buffer.from(
    `saborflow:mfa:totp:v1:${userId}`,
    "utf8",
  )
}

function encryptSecret(
  userId: string,
  secret: string,
) {
  const key = getEncryptionKey()
  const iv = randomBytes(12)

  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    iv,
  )

  cipher.setAAD(
    aadForUser(userId),
  )

  const ciphertext = Buffer.concat([
    cipher.update(
      secret,
      "utf8",
    ),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return [
    "mfaenc1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

function decryptSecret(
  userId: string,
  encrypted: string,
) {
  const [
    version,
    ivEncoded,
    tagEncoded,
    ciphertextEncoded,
  ] = encrypted.split(".")

  if (
    version !== "mfaenc1" ||
    !ivEncoded ||
    !tagEncoded ||
    !ciphertextEncoded
  ) {
    throw new Error(
      "Segredo 2FA armazenado em formato inválido.",
    )
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(
      ivEncoded,
      "base64url",
    ),
  )

  decipher.setAAD(
    aadForUser(userId),
  )

  decipher.setAuthTag(
    Buffer.from(
      tagEncoded,
      "base64url",
    ),
  )

  const plain = Buffer.concat([
    decipher.update(
      Buffer.from(
        ciphertextEncoded,
        "base64url",
      ),
    ),
    decipher.final(),
  ])

  return plain.toString("utf8")
}

function createTotpSecret() {
  return base32Encode(
    randomBytes(20),
  )
}

function totpCodeForStep(
  secret: string,
  step: number,
) {
  const key =
    base32Decode(secret)

  const counter =
    Buffer.alloc(8)

  counter.writeBigUInt64BE(
    BigInt(step),
  )

  const digest = createHmac(
    "sha1",
    key,
  )
    .update(counter)
    .digest()

  const offset =
    digest[digest.length - 1] & 0x0f

  const binary =
    (digest[offset] & 0x7f) *
      0x1000000 +
    digest[offset + 1] *
      0x10000 +
    digest[offset + 2] *
      0x100 +
    digest[offset + 3]

  return String(
    binary %
      10 ** TOTP_DIGITS,
  ).padStart(
    TOTP_DIGITS,
    "0",
  )
}

function codeMatches(
  actual: string,
  expected: string,
) {
  const left =
    Buffer.from(actual)
  const right =
    Buffer.from(expected)

  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  )
}

function matchingTotpStep(
  secret: string,
  rawCode: string,
) {
  const code =
    rawCode.replace(/\D/g, "")

  if (
    code.length !==
    TOTP_DIGITS
  ) {
    return null
  }

  const currentStep =
    Math.floor(
      Date.now() / 1000 /
        TOTP_PERIOD_SECONDS,
    )

  for (
    let offset = -TOTP_WINDOW;
    offset <= TOTP_WINDOW;
    offset += 1
  ) {
    const step =
      currentStep + offset

    if (
      codeMatches(
        code,
        totpCodeForStep(
          secret,
          step,
        ),
      )
    ) {
      return step
    }
  }

  return null
}

function normalizeRecoveryCode(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

function hashRecoveryCode(
  value: string,
) {
  const normalized =
    normalizeRecoveryCode(value)

  return createHmac(
    "sha256",
    getEncryptionKey(),
  )
    .update(
      `saborflow:recovery:v1:${normalized}`,
    )
    .digest("hex")
}

function createRecoveryCode() {
  const raw = randomBytes(10)
    .toString("hex")
    .toUpperCase()

  return raw
    .match(/.{1,4}/g)
    ?.join("-") || raw
}

function createRecoveryCodes() {
  return Array.from(
    {
      length:
        RECOVERY_CODE_COUNT,
    },
    () => createRecoveryCode(),
  )
}

function otpAuthUrl(
  email: string,
  secret: string,
) {
  const issuer = "SaborFlow"
  const label =
    `${issuer}:${email.trim().toLowerCase()}`

  const query =
    new URLSearchParams({
      secret,
      issuer,
      algorithm: "SHA1",
      digits:
        String(TOTP_DIGITS),
      period:
        String(
          TOTP_PERIOD_SECONDS,
        ),
    })

  return (
    `otpauth://totp/` +
    `${encodeURIComponent(label)}?` +
    query.toString()
  )
}

async function getMfaRow(
  userId: string,
) {
  const result =
    await getPostgresPool()
      .query<MfaRow>(
        `
          SELECT
            user_id,
            secret_encrypted,
            enabled,
            last_totp_step::text,
            recovery_code_hashes
          FROM sf_user_mfa
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId],
      )

  return result.rows[0] || null
}

export async function getTwoFactorState(
  userId: string,
) {
  const row =
    await getMfaRow(userId)

  return {
    configured: Boolean(row),
    enabled:
      Boolean(row?.enabled),
  }
}

export async function ensureTwoFactorEnrollment(
  userId: string,
  email: string,
) {
  let row =
    await getMfaRow(userId)

  if (!row) {
    const secret =
      createTotpSecret()

    const encrypted =
      encryptSecret(
        userId,
        secret,
      )

    await getPostgresPool()
      .query(
        `
          INSERT INTO sf_user_mfa (
            user_id,
            method,
            secret_encrypted,
            enabled,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            'totp',
            $2,
            false,
            now(),
            now()
          )
          ON CONFLICT (user_id)
          DO NOTHING
        `,
        [
          userId,
          encrypted,
        ],
      )

    row =
      await getMfaRow(userId)
  }

  if (!row) {
    throw new Error(
      "Não foi possível preparar o 2FA.",
    )
  }

  if (row.enabled) {
    throw new Error(
      "O 2FA já está ativado nesta conta.",
    )
  }

  const secret =
    decryptSecret(
      userId,
      row.secret_encrypted,
    )

  return {
    secret,
    manualKey:
      secret.match(/.{1,4}/g)
        ?.join(" ") ||
      secret,
    otpAuthUrl:
      otpAuthUrl(
        email,
        secret,
      ),
  }
}

export async function activateTwoFactor(
  userId: string,
  rawCode: string,
) {
  const row =
    await getMfaRow(userId)

  if (
    !row ||
    row.enabled
  ) {
    return null
  }

  const secret =
    decryptSecret(
      userId,
      row.secret_encrypted,
    )

  const step =
    matchingTotpStep(
      secret,
      rawCode,
    )

  if (step === null) {
    return null
  }

  const recoveryCodes =
    createRecoveryCodes()

  const hashes =
    recoveryCodes.map(
      hashRecoveryCode,
    )

  const updated =
    await getPostgresPool()
      .query(
        `
          UPDATE sf_user_mfa
          SET
            enabled = true,
            verified_at = now(),
            last_totp_step = $2,
            recovery_code_hashes =
              $3::jsonb,
            updated_at = now()
          WHERE user_id = $1
            AND enabled = false
          RETURNING user_id
        `,
        [
          userId,
          step,
          JSON.stringify(
            hashes,
          ),
        ],
      )

  if (!updated.rowCount) {
    return null
  }

  return {
    recoveryCodes,
  }
}

async function verifyAndConsumeTotp(
  userId: string,
  rawCode: string,
) {
  const row =
    await getMfaRow(userId)

  if (
    !row ||
    !row.enabled
  ) {
    return false
  }

  const secret =
    decryptSecret(
      userId,
      row.secret_encrypted,
    )

  const step =
    matchingTotpStep(
      secret,
      rawCode,
    )

  if (step === null) {
    return false
  }

  const updated =
    await getPostgresPool()
      .query(
        `
          UPDATE sf_user_mfa
          SET
            last_totp_step = $2,
            updated_at = now()
          WHERE user_id = $1
            AND enabled = true
            AND (
              last_totp_step IS NULL
              OR last_totp_step < $2
            )
          RETURNING user_id
        `,
        [
          userId,
          step,
        ],
      )

  return Boolean(
    updated.rowCount,
  )
}

async function verifyAndConsumeRecoveryCode(
  userId: string,
  rawCode: string,
) {
  const normalized =
    normalizeRecoveryCode(
      rawCode,
    )

  if (
    normalized.length < 16
  ) {
    return false
  }

  const hash =
    hashRecoveryCode(
      normalized,
    )

  const updated =
    await getPostgresPool()
      .query(
        `
          UPDATE sf_user_mfa
          SET
            recovery_code_hashes =
              COALESCE(
                (
                  SELECT jsonb_agg(value)
                  FROM jsonb_array_elements_text(
                    recovery_code_hashes
                  ) AS codes(value)
                  WHERE value <> $2
                ),
                '[]'::jsonb
              ),
            updated_at = now()
          WHERE user_id = $1
            AND enabled = true
            AND recovery_code_hashes ? $2
          RETURNING user_id
        `,
        [
          userId,
          hash,
        ],
      )

  return Boolean(
    updated.rowCount,
  )
}

export async function verifySecondFactor(
  userId: string,
  rawCode: string,
) {
  const trimmed =
    rawCode.trim()

  if (
    /^\d{6}$/.test(trimmed)
  ) {
    return verifyAndConsumeTotp(
      userId,
      trimmed,
    )
  }

  return verifyAndConsumeRecoveryCode(
    userId,
    trimmed,
  )
}

export async function markAdminUserLoginCompleted(
  userId: string,
) {
  await getPostgresPool().query(
    `
      UPDATE sf_users
      SET
        last_login_at = now(),
        updated_at = now()
      WHERE id = $1
    `,
    [userId],
  )
}
