import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto"

import {
  decryptIntegrationCredentials,
} from "@/lib/integration-crypto"

import {
  getPostgresPool,
} from "@/lib/postgres"

import {
  runWithRlsBypass,
  runWithTenantRlsScope,
} from "@/lib/rls-context"

const SABORFLOW_WHATSAPP_META_WEBHOOK_14111 =
  true

type JsonObject =
  Record<string, unknown>

type ConnectionRow = {
  id: string
  organization_id: string
  provider: string
  status: string
  encrypted_credentials: string
}

export type WhatsAppMetaWebhookConnection = {
  id: string
  organizationId: string
  status: string
  accessToken: string
  phoneNumberId: string
  appSecret: string
  verifyToken: string
}

export type WhatsAppMetaRecordedEvent = {
  providerEventId: string
  eventType: string
  payload: JsonObject
}

function cleanText(
  value: unknown,
  max = 1000,
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : ""
}

function jsonObject(
  value: unknown,
): JsonObject {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as JsonObject
    : {}
}

function arrayValue(
  value: unknown,
) {
  return Array.isArray(value)
    ? value
    : []
}

function safeTextEqual(
  actual: string,
  expected: string,
) {
  const actualHash =
    createHash("sha256")
      .update(actual)
      .digest()

  const expectedHash =
    createHash("sha256")
      .update(expected)
      .digest()

  return timingSafeEqual(
    actualHash,
    expectedHash,
  )
}

function safeSignatureEqual(
  actual: string,
  expected: string,
) {
  if (
    !/^[a-f0-9]{64}$/i.test(
      actual,
    ) ||
    !/^[a-f0-9]{64}$/i.test(
      expected,
    )
  ) {
    return false
  }

  const actualBuffer =
    Buffer.from(
      actual,
      "hex",
    )

  const expectedBuffer =
    Buffer.from(
      expected,
      "hex",
    )

  return (
    actualBuffer.length ===
      expectedBuffer.length &&
    timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    )
  )
}

export async function getWhatsAppMetaWebhookConnection(
  connectionId: string,
  options?: {
    requireActive?: boolean
  },
): Promise<
  WhatsAppMetaWebhookConnection | null
> {
  const cleanConnectionId =
    cleanText(
      connectionId,
      100,
    )

  if (!cleanConnectionId) {
    return null
  }

  return runWithRlsBypass(
    async () => {
      const result =
        await getPostgresPool()
          .query<ConnectionRow>(
            `
              SELECT
                id,
                organization_id,
                provider,
                status,
                encrypted_credentials
              FROM sf_integration_connections
              WHERE id = $1
              LIMIT 1
            `,
            [cleanConnectionId],
          )

      const row =
        result.rows[0]

      if (
        !row ||
        row.provider !==
          "whatsapp_meta"
      ) {
        return null
      }

      if (
        options
          ?.requireActive !==
          false &&
        row.status !== "active"
      ) {
        return null
      }

      const credentials =
        decryptIntegrationCredentials(
          row
            .encrypted_credentials,
        )

      const accessToken =
        cleanText(
          credentials.accessToken,
          4000,
        )

      const phoneNumberId =
        cleanText(
          credentials.phoneNumberId,
          100,
        )

      const appSecret =
        cleanText(
          credentials.appSecret,
          1000,
        )

      const verifyToken =
        cleanText(
          credentials.verifyToken,
          500,
        )

      if (
        !phoneNumberId ||
        !appSecret ||
        !verifyToken
      ) {
        return null
      }

      return {
        id: row.id,
        organizationId:
          row.organization_id,
        status: row.status,
        accessToken,
        phoneNumberId,
        appSecret,
        verifyToken,
      }
    },
  )
}

export function verifyWhatsAppMetaChallenge(
  connection:
    WhatsAppMetaWebhookConnection,
  providedToken: string,
) {
  const actual =
    cleanText(
      providedToken,
      500,
    )

  if (!actual) {
    return false
  }

  return safeTextEqual(
    actual,
    connection.verifyToken,
  )
}

export function verifyWhatsAppMetaSignature(
  connection:
    WhatsAppMetaWebhookConnection,
  rawBody: string,
  signatureHeader:
    string | null,
) {
  const provided =
    cleanText(
      signatureHeader,
      200,
    )
      .replace(
        /^sha256=/i,
        "",
      )

  const calculated =
    createHmac(
      "sha256",
      connection.appSecret,
    )
      .update(rawBody)
      .digest("hex")

  return safeSignatureEqual(
    provided,
    calculated,
  )
}

function payloadPhoneNumberIds(
  payload: JsonObject,
) {
  const ids =
    new Set<string>()

  for (
    const entryRaw of
    arrayValue(
      payload.entry,
    )
  ) {
    const entry =
      jsonObject(entryRaw)

    for (
      const changeRaw of
      arrayValue(
        entry.changes,
      )
    ) {
      const change =
        jsonObject(changeRaw)

      const value =
        jsonObject(
          change.value,
        )

      const metadata =
        jsonObject(
          value.metadata,
        )

      const phoneNumberId =
        cleanText(
          metadata.phone_number_id,
          100,
        )

      if (phoneNumberId) {
        ids.add(
          phoneNumberId,
        )
      }
    }
  }

  return [...ids]
}

export function whatsappMetaPayloadMatchesConnection(
  connection:
    WhatsAppMetaWebhookConnection,
  payload: JsonObject,
) {
  if (
    cleanText(
      payload.object,
      100,
    ) !==
    "whatsapp_business_account"
  ) {
    return false
  }

  const ids =
    payloadPhoneNumberIds(
      payload,
    )

  if (!ids.length) {
    return false
  }

  return ids.every(
    (id) =>
      safeTextEqual(
        id,
        connection
          .phoneNumberId,
      ),
  )
}

function collectEvents(
  payload: JsonObject,
  rawBody: string,
): WhatsAppMetaRecordedEvent[] {
  const events:
    WhatsAppMetaRecordedEvent[] =
    []

  for (
    const entryRaw of
    arrayValue(
      payload.entry,
    )
  ) {
    const entry =
      jsonObject(entryRaw)

    const entryId =
      cleanText(
        entry.id,
        200,
      )

    for (
      const changeRaw of
      arrayValue(
        entry.changes,
      )
    ) {
      const change =
        jsonObject(changeRaw)

      const field =
        cleanText(
          change.field,
          100,
        )

      const value =
        jsonObject(
          change.value,
        )

      const metadata =
        jsonObject(
          value.metadata,
        )

      const contacts =
        arrayValue(
          value.contacts,
        )

      for (
        const messageRaw of
        arrayValue(
          value.messages,
        )
      ) {
        const message =
          jsonObject(
            messageRaw,
          )

        const id =
          cleanText(
            message.id,
            300,
          )

        if (!id) {
          continue
        }

        const messageType =
          cleanText(
            message.type,
            80,
          ) || "unknown"

        events.push({
          providerEventId:
            `wa:message:${id}`,
          eventType:
            `whatsapp.message.${messageType}`,
          payload: {
            entryId,
            field,
            metadata,
            contacts,
            message,
          },
        })
      }

      for (
        const statusRaw of
        arrayValue(
          value.statuses,
        )
      ) {
        const status =
          jsonObject(
            statusRaw,
          )

        const id =
          cleanText(
            status.id,
            300,
          )

        const state =
          cleanText(
            status.status,
            80,
          ) || "unknown"

        const timestamp =
          cleanText(
            status.timestamp,
            80,
          )

        if (!id) {
          continue
        }

        events.push({
          providerEventId:
            [
              "wa:status",
              id,
              state,
              timestamp,
            ].join(":"),
          eventType:
            `whatsapp.status.${state}`,
          payload: {
            entryId,
            field,
            metadata,
            status,
          },
        })
      }
    }
  }

  if (!events.length) {
    const digest =
      createHash(
        "sha256",
      )
        .update(rawBody)
        .digest("hex")

    events.push({
      providerEventId:
        `wa:webhook:${digest}`,
      eventType:
        "whatsapp.webhook",
      payload,
    })
  }

  return events
}

export async function recordWhatsAppMetaWebhook(
  connection:
    WhatsAppMetaWebhookConnection,
  payload: JsonObject,
  rawBody: string,
) {
  const events =
    collectEvents(
      payload,
      rawBody,
    )

  return runWithTenantRlsScope(
    [
      connection
        .organizationId,
    ],
    undefined,
    async () => {
      const client =
        await getPostgresPool()
          .connect()

      let inserted = 0
      let duplicates = 0

      try {
        await client.query(
          "BEGIN",
        )

        for (
          const event of
          events
        ) {
          const result =
            await client.query(
              `
                INSERT INTO sf_integration_webhook_events (
                  organization_id,
                  connection_id,
                  provider_event_id,
                  event_type,
                  signature_valid,
                  payload,
                  status,
                  received_at
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  true,
                  $5::jsonb,
                  'received',
                  now()
                )
                ON CONFLICT (
                  connection_id,
                  provider_event_id
                )
                DO NOTHING
              `,
              [
                connection
                  .organizationId,
                connection.id,
                event
                  .providerEventId,
                event.eventType,
                JSON.stringify(
                  event.payload,
                ),
              ],
            )

          if (
            result.rowCount
          ) {
            inserted += 1
          } else {
            duplicates += 1
          }
        }

        await client.query(
          "COMMIT",
        )
      } catch (error) {
        await client.query(
          "ROLLBACK",
        )
        throw error
      } finally {
        client.release()
      }

      return {
        events:
          events.length,
        inserted,
        duplicates,
      }
    },
    "public-store",
  )
}
