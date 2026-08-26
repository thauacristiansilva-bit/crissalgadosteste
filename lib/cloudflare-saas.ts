import "server-only"

import { normalizePublicDomain } from "@/lib/organization-db"

type CloudflareValidationRecord = {
  status?: string
  txt_name?: string
  txt_value?: string
  cname?: string
  cname_target?: string
}

type CloudflareCustomHostname = {
  id: string
  hostname: string
  status?: string
  verification_errors?: string[]
  ownership_verification?: {
    name?: string
    type?: "txt"
    value?: string
  }
  ssl?: {
    status?: string
    method?: string
    txt_name?: string
    txt_value?: string
    validation_records?: CloudflareValidationRecord[]
    validation_errors?: Array<{ message?: string }>
  }
}

type CloudflareEnvelope<T> = {
  success: boolean
  result: T
  errors?: Array<{ code?: number; message?: string }>
  messages?: Array<{ code?: number; message?: string }>
}

export type SaaSDnsRecord = {
  type: "CNAME" | "TXT"
  name: string
  value: string
  purpose: "traffic" | "hostname_verification" | "ssl_validation"
  status: string | null
}

export type CloudflareSaaSRouting = {
  provider: "cloudflare_saas"
  hostnameId: string
  hostnameStatus: string | null
  sslStatus: string | null
  ready: boolean
  cnameTarget: string
  dnsRecords: SaaSDnsRecord[]
  errors: string[]
}

function getConfig() {
  const zoneId = (process.env.CLOUDFLARE_ZONE_ID || "").trim()
  const apiToken = (process.env.CLOUDFLARE_SAAS_API_TOKEN || "").trim()
  const cnameTarget = normalizePublicDomain(
    process.env.CLOUDFLARE_SAAS_CNAME_TARGET || "customers.appsaborflow.com.br",
  )

  if (!zoneId || !apiToken || !cnameTarget) {
    throw new Error(
      "Cloudflare for SaaS ainda não está configurado. Defina CLOUDFLARE_ZONE_ID, CLOUDFLARE_SAAS_API_TOKEN e CLOUDFLARE_SAAS_CNAME_TARGET no Railway.",
    )
  }

  return { zoneId, apiToken, cnameTarget }
}

function messageFromEnvelope(value: CloudflareEnvelope<unknown>) {
  const messages = [
    ...(value.errors || []),
    ...(value.messages || []),
  ]
    .map((item) => item.message?.trim())
    .filter(Boolean)

  return messages.join("; ") || "A API da Cloudflare recusou a operação."
}

async function cloudflareRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { zoneId, apiToken } = getConfig()
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    },
  )

  const envelope = (await response.json().catch(() => null)) as CloudflareEnvelope<T> | null

  if (!response.ok || !envelope?.success) {
    throw new Error(
      envelope
        ? `Cloudflare for SaaS: ${messageFromEnvelope(envelope)}`
        : `Cloudflare for SaaS: resposta HTTP ${response.status}.`,
    )
  }

  return envelope.result
}

export async function getCloudflareCustomHostname(domain: string) {
  const clean = normalizePublicDomain(domain)
  if (!clean) return null

  const result = await cloudflareRequest<CloudflareCustomHostname[]>(
    `/custom_hostnames?hostname=${encodeURIComponent(clean)}&per_page=5`,
  )

  return result.find((item) => normalizePublicDomain(item.hostname) === clean) || null
}

export async function ensureCloudflareCustomHostname(domain: string) {
  const clean = normalizePublicDomain(domain)
  if (!clean) throw new Error("Domínio inválido.")

  const current = await getCloudflareCustomHostname(clean)
  if (current) return current

  return cloudflareRequest<CloudflareCustomHostname>("/custom_hostnames", {
    method: "POST",
    body: JSON.stringify({
      hostname: clean,
      ssl: {
        method: "txt",
        type: "dv",
      },
    }),
  })
}

export async function removeCloudflareCustomHostname(domain: string) {
  const zoneId = (process.env.CLOUDFLARE_ZONE_ID || "").trim()
  const apiToken = (process.env.CLOUDFLARE_SAAS_API_TOKEN || "").trim()

  // Permite limpar um domínio local antigo mesmo antes da configuração da Etapa 10.
  if (!zoneId || !apiToken) return false

  const current = await getCloudflareCustomHostname(domain)
  if (!current) return false

  await cloudflareRequest<{ id?: string }>(`/custom_hostnames/${current.id}`, {
    method: "DELETE",
  })

  return true
}

function addRecord(records: SaaSDnsRecord[], record: SaaSDnsRecord) {
  const key = `${record.type}|${record.name.toLowerCase()}|${record.value}`
  if (records.some((item) => `${item.type}|${item.name.toLowerCase()}|${item.value}` === key)) {
    return
  }
  records.push(record)
}

export function cloudflareDnsInstructions(
  hostname: CloudflareCustomHostname,
): CloudflareSaaSRouting {
  const { cnameTarget } = getConfig()
  const dnsRecords: SaaSDnsRecord[] = []

  addRecord(dnsRecords, {
    type: "CNAME",
    name: hostname.hostname,
    value: cnameTarget,
    purpose: "traffic",
    status: hostname.status || null,
  })

  const ownership = hostname.ownership_verification
  if (ownership?.name && ownership.value) {
    addRecord(dnsRecords, {
      type: "TXT",
      name: ownership.name,
      value: ownership.value,
      purpose: "hostname_verification",
      status: hostname.status || null,
    })
  }

  if (hostname.ssl?.txt_name && hostname.ssl.txt_value) {
    addRecord(dnsRecords, {
      type: "TXT",
      name: hostname.ssl.txt_name,
      value: hostname.ssl.txt_value,
      purpose: "ssl_validation",
      status: hostname.ssl.status || null,
    })
  }

  for (const record of hostname.ssl?.validation_records || []) {
    if (record.txt_name && record.txt_value) {
      addRecord(dnsRecords, {
        type: "TXT",
        name: record.txt_name,
        value: record.txt_value,
        purpose: "ssl_validation",
        status: record.status || hostname.ssl?.status || null,
      })
    }
    if (record.cname && record.cname_target) {
      addRecord(dnsRecords, {
        type: "CNAME",
        name: record.cname,
        value: record.cname_target,
        purpose: "ssl_validation",
        status: record.status || hostname.ssl?.status || null,
      })
    }
  }

  const errors = [
    ...(hostname.verification_errors || []),
    ...(hostname.ssl?.validation_errors || [])
      .map((item) => item.message || "")
      .filter(Boolean),
  ]

  return {
    provider: "cloudflare_saas",
    hostnameId: hostname.id,
    hostnameStatus: hostname.status || null,
    sslStatus: hostname.ssl?.status || null,
    ready: hostname.status === "active" && hostname.ssl?.status === "active",
    cnameTarget,
    dnsRecords,
    errors,
  }
}
