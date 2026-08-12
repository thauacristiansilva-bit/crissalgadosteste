import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { getDemoHealthCounts } from "@/lib/demo-db"
import { getDemoEnvironmentForOrganization } from "@/lib/demo-policy"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const [environment, counts] = await Promise.all([
    getDemoEnvironmentForOrganization(session.organizationId),
    getDemoHealthCounts(),
  ])

  return NextResponse.json({
    ok: true,
    phase: "16-demo-trial",
    schemaReady: counts !== null,
    currentOrganization: {
      id: session.organizationId,
      name: session.organizationName,
      demo: Boolean(environment),
      environment,
    },
    environments: counts,
    policy: {
      isolatedTenant: true,
      externalWebhooks: false,
      externalPrinting: false,
      customDomain: false,
      dangerousIntegrations: false,
      maxDemoUsers: 3,
      semanticExpiry: "server-enforced",
    },
  })
}
