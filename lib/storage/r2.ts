import { createHash, createHmac } from "node:crypto"

type R2Config = {
  endpoint: string
  host: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string
}

function clean(value: string | undefined) {
  return value?.trim() || ""
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function encodedPath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map(awsEncode)
    .join("/")
}

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest()
}

function signingKey(secret: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp)
  const regionKey = hmac(dateKey, "auto")
  const serviceKey = hmac(regionKey, "s3")
  return hmac(serviceKey, "aws4_request")
}

function amzTimestamp(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "")
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  }
}

export function getR2Config(): R2Config | null {
  const accountId = clean(process.env.R2_ACCOUNT_ID)
  const bucket = clean(process.env.R2_BUCKET_NAME)
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID)
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY)
  const publicBaseUrl = clean(process.env.R2_PUBLIC_BASE_URL).replace(/\/+$/, "")
  const configuredEndpoint = clean(process.env.R2_ENDPOINT).replace(/\/+$/, "")
  const endpoint = configuredEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null
  }

  let host = ""
  try {
    host = new URL(endpoint).host
    void new URL(publicBaseUrl)
  } catch {
    return null
  }

  return {
    endpoint,
    host,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  }
}

export function mediaStorageMode() {
  return clean(process.env.MEDIA_STORAGE_MODE).toLowerCase() === "r2"
    ? "r2"
    : "local"
}

export function r2PublicUrl(key: string, config = getR2Config()) {
  if (!config) throw new Error("Cloudflare R2 não está configurado.")
  return `${config.publicBaseUrl}/${encodedPath(key)}`
}

async function signedR2Request(input: {
  method: "PUT" | "HEAD"
  key: string
  body?: Uint8Array
  contentType?: string
}) {
  const config = getR2Config()
  if (!config) {
    throw new Error("Cloudflare R2 não está configurado no Railway.")
  }

  const body = input.body ?? new Uint8Array()
  const payloadHash = sha256Hex(body)
  const { amzDate, dateStamp } = amzTimestamp()
  const canonicalUri = `/${awsEncode(config.bucket)}/${encodedPath(input.key)}`
  const requestUrl = `${config.endpoint}${canonicalUri}`

  const requestHeaders: Record<string, string> = {
    host: config.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }

  if (input.method === "PUT") {
    requestHeaders["cache-control"] = "public, max-age=31536000, immutable"
    requestHeaders["content-type"] = input.contentType || "application/octet-stream"
  }

  const signedHeaderNames = Object.keys(requestHeaders).sort()
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${requestHeaders[name].trim()}\n`)
    .join("")
  const signedHeaders = signedHeaderNames.join(";")

  const canonicalRequest = [
    input.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")

  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex")

  const headers = new Headers()
  for (const [name, value] of Object.entries(requestHeaders)) {
    if (name !== "host") headers.set(name, value)
  }
  headers.set(
    "authorization",
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  )

  return fetch(requestUrl, {
    method: input.method,
    headers,
    body: input.method === "PUT" ? body : undefined,
    cache: "no-store",
  })
}

export async function putR2Object(
  key: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const response = await signedR2Request({
    method: "PUT",
    key,
    body: bytes,
    contentType,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Falha ao enviar mídia para o R2 (${response.status}).${detail ? ` ${detail.slice(0, 220)}` : ""}`,
    )
  }

  return r2PublicUrl(key)
}

export async function r2ObjectExists(key: string) {
  const response = await signedR2Request({ method: "HEAD", key })
  if (response.status === 404) return false
  if (!response.ok) {
    throw new Error(`Falha ao consultar mídia no R2 (${response.status}).`)
  }
  return true
}
