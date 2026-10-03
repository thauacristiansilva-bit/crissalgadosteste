import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

const DEFAULT_GRAPH_VERSION = "v25.0"

function required(name: string) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error(`Variavel ${name} nao configurada.`)
  return value
}

export function metaGraphVersion() {
  const value = String(process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION).trim()
  return /^v\d+\.\d+$/.test(value) ? value : DEFAULT_GRAPH_VERSION
}

export function metaAppId() {
  return required("META_APP_ID")
}

export function metaAppSecret() {
  return required("META_APP_SECRET")
}

export function metaPublicBaseUrl() {
  const raw = String(
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    "",
  ).trim()

  if (!raw) {
    throw new Error("APP_PUBLIC_URL nao configurada.")
  }

  const url = new URL(raw)
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_PUBLIC_URL precisa usar HTTPS.")
  }
  return url.origin
}

export function metaRedirectUri() {
  const explicit = String(process.env.META_INSTAGRAM_REDIRECT_URI || "").trim()
  return explicit || `${metaPublicBaseUrl()}/api/meta/instagram/callback`
}

function tokenKey() {
  const secret = required("META_TOKEN_ENCRYPTION_KEY")
  return createHash("sha256").update(secret, "utf8").digest()
}

export function encryptMetaToken(token: string) {
  const clean = String(token || "").trim()
  if (!clean) throw new Error("Token da Meta vazio.")

  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(clean, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".")
}

export function decryptMetaToken(value: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = String(value || "").split(".")
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Token da Meta armazenado em formato invalido.")
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    tokenKey(),
    Buffer.from(ivRaw, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"))

  const plain = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ])
  return plain.toString("utf8")
}

type OauthStatePayload = {
  organizationId: string
  userId: string
  nonce: string
  exp: number
}

function stateSecret() {
  return String(
    process.env.META_OAUTH_STATE_SECRET ||
    process.env.META_APP_SECRET ||
    "",
  ).trim()
}

export function createMetaOauthState(
  organizationId: string,
  userId: string,
) {
  const secret = stateSecret()
  if (!secret) throw new Error("META_OAUTH_STATE_SECRET/META_APP_SECRET nao configurada.")

  const payload: OauthStatePayload = {
    organizationId,
    userId,
    nonce: randomBytes(18).toString("base64url"),
    exp: Date.now() + 10 * 60 * 1000,
  }

  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret).update(data).digest("base64url")
  return `${data}.${signature}`
}

export function verifyMetaOauthState(state: string): OauthStatePayload {
  const [data, signature] = String(state || "").split(".")
  const secret = stateSecret()
  if (!data || !signature || !secret) {
    throw new Error("Estado OAuth invalido.")
  }

  const expected = createHmac("sha256", secret).update(data).digest()
  const received = Buffer.from(signature, "base64url")
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Assinatura OAuth invalida.")
  }

  const payload = JSON.parse(
    Buffer.from(data, "base64url").toString("utf8"),
  ) as OauthStatePayload

  if (
    !payload.organizationId ||
    !payload.userId ||
    !payload.exp ||
    payload.exp < Date.now()
  ) {
    throw new Error("Estado OAuth expirado.")
  }

  return payload
}

export function metaAuthorizationUrl(
  organizationId: string,
  userId: string,
) {
  const version = metaGraphVersion()
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`)
  url.searchParams.set("client_id", metaAppId())
  url.searchParams.set("redirect_uri", metaRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set(
    "scope",
    [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
    ].join(","),
  )
  url.searchParams.set("auth_type", "rerequest")
  url.searchParams.set("state", createMetaOauthState(organizationId, userId))
  return url.toString()
}

type TokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: {
    message?: string
  }
}

async function graphJson<T>(
  url: URL | string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  })
  const text = await response.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!response.ok || data?.error) {
    const message =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Erro HTTP ${response.status} na Meta.`
    throw new Error(message)
  }

  return data as T
}

export async function exchangeFacebookCode(code: string) {
  const version = metaGraphVersion()
  const shortUrl = new URL(
    `https://graph.facebook.com/${version}/oauth/access_token`,
  )
  shortUrl.searchParams.set("client_id", metaAppId())
  shortUrl.searchParams.set("client_secret", metaAppSecret())
  shortUrl.searchParams.set("redirect_uri", metaRedirectUri())
  shortUrl.searchParams.set("code", code)

  const short = await graphJson<TokenResponse>(shortUrl)
  if (!short.access_token) {
    throw new Error("A Meta nao retornou token de acesso.")
  }

  const longUrl = new URL(
    `https://graph.facebook.com/${version}/oauth/access_token`,
  )
  longUrl.searchParams.set("grant_type", "fb_exchange_token")
  longUrl.searchParams.set("client_id", metaAppId())
  longUrl.searchParams.set("client_secret", metaAppSecret())
  longUrl.searchParams.set("fb_exchange_token", short.access_token)

  try {
    const long = await graphJson<TokenResponse>(longUrl)
    if (long.access_token) {
      return {
        accessToken: long.access_token,
        expiresIn: Number(long.expires_in || 0),
      }
    }
  } catch {
    // Mantem o token curto como fallback. A interface avisa se reconexao for necessaria.
  }

  return {
    accessToken: short.access_token,
    expiresIn: Number(short.expires_in || 0),
  }
}

export type MetaInstagramAccount = {
  pageId: string
  pageName: string
  pageAccessToken: string
  instagramUserId: string
  username: string
  accountType: string
}

type PageRow = {
  id?: string
  name?: string
  access_token?: string
  instagram_business_account?: {
    id?: string
  }
}

export async function resolveInstagramAccount(
  userAccessToken: string,
): Promise<MetaInstagramAccount> {
  const version = metaGraphVersion()
  const url = new URL(`https://graph.facebook.com/${version}/me/accounts`)
  url.searchParams.set(
    "fields",
    "id,name,access_token,tasks,instagram_business_account",
  )
  url.searchParams.set("limit", "100")
  url.searchParams.set("access_token", userAccessToken)

  const pages = await graphJson<{ data?: PageRow[] }>(url)
  const page = (pages.data || []).find(
    (item) =>
      item.id &&
      item.access_token &&
      item.instagram_business_account?.id,
  )

  if (!page?.id || !page.access_token || !page.instagram_business_account?.id) {
    throw new Error(
      "Nao encontrei uma Pagina do Facebook ligada a uma conta profissional do Instagram.",
    )
  }

  const igId = page.instagram_business_account.id
  const igUrl = new URL(`https://graph.facebook.com/${version}/${igId}`)
  igUrl.searchParams.set("fields", "id,username,account_type")
  igUrl.searchParams.set("access_token", page.access_token)

  const ig = await graphJson<{
    id?: string
    username?: string
    account_type?: string
  }>(igUrl)

  return {
    pageId: page.id,
    pageName: String(page.name || ""),
    pageAccessToken: page.access_token,
    instagramUserId: ig.id || igId,
    username: String(ig.username || ""),
    accountType: String(ig.account_type || ""),
  }
}

export function absoluteMarketingMediaUrl(mediaUrl: string) {
  const clean = String(mediaUrl || "").trim()
  if (!clean) throw new Error("A publicacao nao possui arte para enviar.")
  const url = new URL(clean, metaPublicBaseUrl())
  if (url.protocol !== "https:") {
    throw new Error("A Meta exige uma URL publica HTTPS para a arte.")
  }
  return url.toString()
}

type ContainerResponse = {
  id?: string
}

type ContainerStatus = {
  id?: string
  status_code?: string
  status?: string
}

export async function createInstagramImageContainer(input: {
  igUserId: string
  accessToken: string
  imageUrl: string
  caption?: string
  story?: boolean
}) {
  const version = metaGraphVersion()
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(input.igUserId)}/media`
  const body = new URLSearchParams()
  body.set("image_url", input.imageUrl)
  body.set("access_token", input.accessToken)

  if (input.story) {
    body.set("media_type", "STORIES")
  } else if (input.caption) {
    body.set("caption", input.caption.slice(0, 2200))
  }

  const data = await graphJson<ContainerResponse>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!data.id) {
    throw new Error("A Meta nao retornou o container da publicacao.")
  }
  return data.id
}

export async function waitInstagramContainer(
  containerId: string,
  accessToken: string,
) {
  const version = metaGraphVersion()

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const url = new URL(
      `https://graph.facebook.com/${version}/${encodeURIComponent(containerId)}`,
    )
    url.searchParams.set("fields", "status_code,status")
    url.searchParams.set("access_token", accessToken)

    const status = await graphJson<ContainerStatus>(url)
    if (!status.status_code || status.status_code === "FINISHED") {
      return
    }
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(status.status || "A Meta nao conseguiu processar a arte.")
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  throw new Error("A Meta demorou demais para processar a arte.")
}

export async function publishInstagramContainer(input: {
  igUserId: string
  accessToken: string
  containerId: string
}) {
  const version = metaGraphVersion()
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(input.igUserId)}/media_publish`
  const body = new URLSearchParams()
  body.set("creation_id", input.containerId)
  body.set("access_token", input.accessToken)

  const data = await graphJson<{ id?: string }>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!data.id) {
    throw new Error("A Meta nao retornou o ID da publicacao.")
  }
  return data.id
}
