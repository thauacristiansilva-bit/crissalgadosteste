import {
  createHash,
} from "node:crypto"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type WebAuthnCredential,
} from "@simplewebauthn/server"
import {
  getPostgresPool,
} from "@/lib/postgres"

const RP_NAME = "SaborFlow"
const MAX_PASSKEYS_PER_USER = 10

type PasskeyRow = {
  credential_id: string
  user_id: string
  public_key: Buffer
  counter: string | number
  transports: unknown
  device_type:
    | "singleDevice"
    | "multiDevice"
  backed_up: boolean
  name: string
  created_at: Date | string
  last_used_at:
    | Date
    | string
    | null
}

export type PasskeySummary = {
  id: string
  name: string
  deviceType:
    | "singleDevice"
    | "multiDevice"
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

export type WebAuthnRequestConfig = {
  rpID: string
  expectedOrigin: string
}

type RegistrationResponse =
  Parameters<
    typeof verifyRegistrationResponse
  >[0]["response"]

type AuthenticationResponse =
  Parameters<
    typeof verifyAuthenticationResponse
  >[0]["response"]

function firstForwardedValue(
  value: string | null,
) {
  return (
    value
      ?.split(",")[0]
      ?.trim() || ""
  )
}

function hostWithoutPort(
  host: string,
) {
  if (
    host.startsWith("[") &&
    host.includes("]")
  ) {
    return host
      .slice(
        1,
        host.indexOf("]"),
      )
      .toLowerCase()
  }

  return host
    .replace(/:\d+$/, "")
    .toLowerCase()
}

function configuredBaseHostname() {
  const configured =
    process.env.APP_BASE_URL?.trim()

  if (!configured) {
    return ""
  }

  try {
    return new URL(
      configured,
    ).hostname.toLowerCase()
  } catch {
    return ""
  }
}

export function getWebAuthnRequestConfig(
  request: Request,
): WebAuthnRequestConfig {
  const url =
    new URL(request.url)

  const forwardedHost =
    firstForwardedValue(
      request.headers.get(
        "x-forwarded-host",
      ),
    )

  const rawHost =
    forwardedHost ||
    request.headers.get("host") ||
    url.host

  const hostname =
    hostWithoutPort(rawHost)

  const forwardedProto =
    firstForwardedValue(
      request.headers.get(
        "x-forwarded-proto",
      ),
    )

  const protocol =
    forwardedProto ||
    url.protocol.replace(
      ":",
      "",
    )

  if (!hostname) {
    throw new Error(
      "Host inválido para WebAuthn.",
    )
  }

  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"

  if (
    !isLocalhost &&
    protocol !== "https"
  ) {
    throw new Error(
      "Passkeys exigem HTTPS fora do ambiente local.",
    )
  }

  const baseHostname =
    configuredBaseHostname()

  const canUseBaseRp =
    Boolean(
      baseHostname &&
        (
          hostname ===
            baseHostname ||
          hostname.endsWith(
            `.${baseHostname}`,
          )
        ),
    )

  const rpID =
    isLocalhost
      ? "localhost"
      : canUseBaseRp
        ? baseHostname
        : hostname

  const expectedOrigin =
    `${protocol}://${rawHost}`

  return {
    rpID,
    expectedOrigin,
  }
}

function stableUserHandle(
  userId: string,
) {
  return new Uint8Array(
    createHash("sha256")
      .update(
        `saborflow:webauthn-user:v1:${userId}`,
      )
      .digest(),
  )
}

function normalizeTransports(
  value: unknown,
): WebAuthnCredential["transports"] {
  if (!Array.isArray(value)) {
    return []
  }

  const allowed =
    new Set([
      "ble",
      "cable",
      "hybrid",
      "internal",
      "nfc",
      "smart-card",
      "usb",
    ])

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
        "string" &&
      allowed.has(item),
  ) as WebAuthnCredential["transports"]
}

function rowToCredential(
  row: PasskeyRow,
): WebAuthnCredential {
  return {
    id:
      row.credential_id,
    publicKey:
      new Uint8Array(
        row.public_key,
      ),
    counter:
      Number(row.counter || 0),
    transports:
      normalizeTransports(
        row.transports,
      ),
  }
}

function rowToSummary(
  row: PasskeyRow,
): PasskeySummary {
  return {
    id:
      row.credential_id,
    name:
      row.name,
    deviceType:
      row.device_type,
    backedUp:
      Boolean(row.backed_up),
    createdAt:
      new Date(
        row.created_at,
      ).toISOString(),
    lastUsedAt:
      row.last_used_at
        ? new Date(
            row.last_used_at,
          ).toISOString()
        : null,
  }
}

async function rowsForUser(
  userId: string,
) {
  const result =
    await getPostgresPool()
      .query<PasskeyRow>(
        `
          SELECT
            credential_id,
            user_id,
            public_key,
            counter,
            transports,
            device_type,
            backed_up,
            name,
            created_at,
            last_used_at
          FROM sf_user_passkeys
          WHERE user_id = $1
          ORDER BY
            created_at DESC
        `,
        [userId],
      )

  return result.rows
}

export async function listUserPasskeys(
  userId: string,
) {
  const rows =
    await rowsForUser(
      userId,
    )

  return rows.map(
    rowToSummary,
  )
}

export async function userHasPasskeys(
  userId: string,
) {
  const result =
    await getPostgresPool()
      .query<{
        count: number
      }>(
        `
          SELECT
            COUNT(*)::int AS count
          FROM sf_user_passkeys
          WHERE user_id = $1
        `,
        [userId],
      )

  return (
    Number(
      result.rows[0]?.count ||
        0,
    ) > 0
  )
}

async function passkeyForUser(
  userId: string,
  credentialId: string,
) {
  const result =
    await getPostgresPool()
      .query<PasskeyRow>(
        `
          SELECT
            credential_id,
            user_id,
            public_key,
            counter,
            transports,
            device_type,
            backed_up,
            name,
            created_at,
            last_used_at
          FROM sf_user_passkeys
          WHERE user_id = $1
            AND credential_id = $2
          LIMIT 1
        `,
        [
          userId,
          credentialId,
        ],
      )

  return result.rows[0] || null
}

export async function createPasskeyRegistrationOptions(
  input: {
    userId: string
    email: string
    rpID: string
  },
) {
  const rows =
    await rowsForUser(
      input.userId,
    )

  if (
    rows.length >=
    MAX_PASSKEYS_PER_USER
  ) {
    throw new Error(
      "Esta conta já atingiu o limite de 10 Passkeys/chaves de segurança.",
    )
  }

  return generateRegistrationOptions({
    rpName:
      RP_NAME,
    rpID:
      input.rpID,
    userID:
      stableUserHandle(
        input.userId,
      ),
    userName:
      input.email
        .trim()
        .toLowerCase(),
    userDisplayName:
      input.email
        .trim()
        .toLowerCase(),
    attestationType:
      "none",
    excludeCredentials:
      rows.map(
        (row) => ({
          id:
            row.credential_id,
          transports:
            normalizeTransports(
              row.transports,
            ),
        }),
      ),
    authenticatorSelection: {
      residentKey:
        "preferred",
      userVerification:
        "preferred",
    },
    supportedAlgorithmIDs: [
      -7,
      -257,
    ],
    timeout:
      60_000,
  })
}

export async function verifyAndStorePasskeyRegistration(
  input: {
    userId: string
    name: string
    response: RegistrationResponse
    expectedChallenge: string
    expectedOrigin: string
    expectedRPID: string
  },
) {
  const verification =
    await verifyRegistrationResponse({
      response:
        input.response,
      expectedChallenge:
        input.expectedChallenge,
      expectedOrigin:
        input.expectedOrigin,
      expectedRPID:
        input.expectedRPID,
      requireUserVerification:
        false,
    })

  if (
    !verification.verified ||
    !verification.registrationInfo
  ) {
    return null
  }

  const {
    credential,
    credentialDeviceType,
    credentialBackedUp,
  } =
    verification.registrationInfo

  const name =
    input.name
      .trim()
      .replace(
        /\s+/g,
        " ",
      )
      .slice(
        0,
        80,
      )

  if (
    name.length < 2
  ) {
    throw new Error(
      "Nome inválido para a Passkey.",
    )
  }

  const result =
    await getPostgresPool()
      .query<PasskeyRow>(
        `
          INSERT INTO sf_user_passkeys (
            credential_id,
            user_id,
            public_key,
            counter,
            transports,
            device_type,
            backed_up,
            name,
            created_at
          )
          SELECT
            $1,
            $2,
            $3,
            $4,
            $5::jsonb,
            $6,
            $7,
            $8,
            now()
          WHERE (
            SELECT COUNT(*)
            FROM sf_user_passkeys
            WHERE user_id = $2
          ) < $9
          ON CONFLICT (
            credential_id
          )
          DO NOTHING
          RETURNING
            credential_id,
            user_id,
            public_key,
            counter,
            transports,
            device_type,
            backed_up,
            name,
            created_at,
            last_used_at
        `,
        [
          credential.id,
          input.userId,
          Buffer.from(
            credential.publicKey,
          ),
          credential.counter,
          JSON.stringify(
            credential.transports ||
              [],
          ),
          credentialDeviceType,
          credentialBackedUp,
          name,
          MAX_PASSKEYS_PER_USER,
        ],
      )

  const row =
    result.rows[0]

  if (!row) {
    throw new Error(
      "Não foi possível salvar a Passkey. Ela pode já estar cadastrada ou o limite da conta foi atingido.",
    )
  }

  return rowToSummary(
    row,
  )
}

export async function createPasskeyAuthenticationOptions(
  input: {
    userId: string
    rpID: string
  },
) {
  const rows =
    await rowsForUser(
      input.userId,
    )

  if (!rows.length) {
    throw new Error(
      "Nenhuma Passkey cadastrada nesta conta.",
    )
  }

  return generateAuthenticationOptions({
    rpID:
      input.rpID,
    allowCredentials:
      rows.map(
        (row) => ({
          id:
            row.credential_id,
          transports:
            normalizeTransports(
              row.transports,
            ),
        }),
      ),
    userVerification:
      "preferred",
    timeout:
      60_000,
  })
}

export async function verifyPasskeyAuthentication(
  input: {
    userId: string
    response: AuthenticationResponse
    expectedChallenge: string
    expectedOrigin: string
    expectedRPID: string
  },
) {
  const credentialId =
    input.response?.id

  if (
    !credentialId ||
    typeof credentialId !==
      "string"
  ) {
    return null
  }

  const row =
    await passkeyForUser(
      input.userId,
      credentialId,
    )

  if (!row) {
    return null
  }

  const verification =
    await verifyAuthenticationResponse({
      response:
        input.response,
      expectedChallenge:
        input.expectedChallenge,
      expectedOrigin:
        input.expectedOrigin,
      expectedRPID:
        input.expectedRPID,
      credential:
        rowToCredential(
          row,
        ),
      requireUserVerification:
        false,
    })

  if (!verification.verified) {
    return null
  }

  const newCounter =
    verification
      .authenticationInfo
      .newCounter

  await getPostgresPool()
    .query(
      `
        UPDATE sf_user_passkeys
        SET
          counter = $3,
          last_used_at = now()
        WHERE user_id = $1
          AND credential_id = $2
      `,
      [
        input.userId,
        credentialId,
        newCounter,
      ],
    )

  return {
    credentialId,
    newCounter,
  }
}

export async function deleteUserPasskey(
  userId: string,
  credentialId: string,
) {
  const result =
    await getPostgresPool()
      .query(
        `
          DELETE FROM sf_user_passkeys
          WHERE user_id = $1
            AND credential_id = $2
          RETURNING credential_id
        `,
        [
          userId,
          credentialId,
        ],
      )

  return Boolean(
    result.rowCount,
  )
}
