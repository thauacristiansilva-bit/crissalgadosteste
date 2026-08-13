import {
  cookies,
  headers,
} from "next/headers"
import {
  getDefaultDeploymentOrganization,
  getPublicOrganizationByDomain,
  getPublicOrganizationBySlug,
  normalizePublicDomain,
  type PublicOrganization,
} from "@/lib/organization-db"

import { enterTenantRlsContext } from "@/lib/rls-context"

function activatePublicRls(organization: PublicOrganization | null) {
  if (organization) {
    enterTenantRlsContext(
      organization.id,
      undefined,
      "public-store",
    )
  }
  return organization
}

export const PUBLIC_TENANT_COOKIE =
  "saborflow_store_slug"

function cookieValue(
  cookieHeader: string,
  name: string,
) {
  const prefix = `${name}=`

  for (const part of cookieHeader.split(";")) {
    const clean = part.trim()

    if (clean.startsWith(prefix)) {
      try {
        return decodeURIComponent(
          clean.slice(prefix.length),
        )
      } catch {
        return clean.slice(prefix.length)
      }
    }
  }

  return ""
}

function requestHost(request: Request) {
  return normalizePublicDomain(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "",
  )
}

function sharedRailwayDomain() {
  return normalizePublicDomain(
    process.env.RAILWAY_PUBLIC_DOMAIN || "",
  )
}

export async function resolvePublicOrganizationForRequest(
  request: Request,
  explicitSlug?: string,
): Promise<PublicOrganization | null> {
  if (explicitSlug) {
    return activatePublicRls(
      await getPublicOrganizationBySlug(explicitSlug),
    )
  }

  const host = requestHost(request)
  const shared = sharedRailwayDomain()
  const isSharedHost =
    Boolean(host) &&
    Boolean(shared) &&
    host === shared

  // Domínio customizado sempre vence cookie antigo.
  if (host && !isSharedHost) {
    const byDomain =
      await getPublicOrganizationByDomain(host)

    if (byDomain) return activatePublicRls(byDomain)
  }

  const selectedSlug = cookieValue(
    request.headers.get("cookie") || "",
    PUBLIC_TENANT_COOKIE,
  )

  if (selectedSlug) {
    const bySlug =
      await getPublicOrganizationBySlug(
        selectedSlug,
      )

    if (bySlug) return activatePublicRls(bySlug)
  }

  if (host) {
    const byDomain =
      await getPublicOrganizationByDomain(host)

    if (byDomain) return activatePublicRls(byDomain)
  }

  return activatePublicRls(
    await getDefaultDeploymentOrganization(),
  )
}

export async function resolveServerPublicOrganization(
  explicitSlug?: string,
): Promise<PublicOrganization | null> {
  if (explicitSlug) {
    return activatePublicRls(
      await getPublicOrganizationBySlug(explicitSlug),
    )
  }

  const headerStore = await headers()
  const cookieStore = await cookies()

  const host = normalizePublicDomain(
    headerStore.get("x-forwarded-host") ||
      headerStore.get("host") ||
      "",
  )

  const shared = sharedRailwayDomain()
  const isSharedHost =
    Boolean(host) &&
    Boolean(shared) &&
    host === shared

  if (host && !isSharedHost) {
    const byDomain =
      await getPublicOrganizationByDomain(host)

    if (byDomain) return activatePublicRls(byDomain)
  }

  const selectedSlug =
    cookieStore.get(PUBLIC_TENANT_COOKIE)?.value

  if (selectedSlug) {
    const bySlug =
      await getPublicOrganizationBySlug(
        selectedSlug,
      )

    if (bySlug) return activatePublicRls(bySlug)
  }

  if (host) {
    const byDomain =
      await getPublicOrganizationByDomain(host)

    if (byDomain) return activatePublicRls(byDomain)
  }

  return activatePublicRls(
    await getDefaultDeploymentOrganization(),
  )
}
