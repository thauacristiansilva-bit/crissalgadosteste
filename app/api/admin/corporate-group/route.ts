import { NextResponse } from "next/server"
import {
  addCorporateMember,
  addCorporateUnit,
  createCorporateGroup,
  getCorporateOverview,
  removeCorporateUnit,
  renameCorporateGroup,
  setCorporateHeadquarters,
  setCorporateMemberStatus,
  type CorporateGroupRole,
} from "@/lib/corporate-db"
import {
  corporateRequestIp,
  corporateRequestIsSameOrigin,
} from "@/lib/corporate-request"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    return NextResponse.json(await getCorporateOverview(session))
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível carregar a gestão corporativa.",
      },
      { status: 500 },
    )
  }
}

type ActionBody =
  | {
      action: "createGroup"
      name?: string
      headquartersOrganizationId?: string
      organizationIds?: string[]
    }
  | { action: "renameGroup"; groupId?: string; name?: string }
  | {
      action: "addUnit"
      groupId?: string
      organizationId?: string
      unitCode?: string
      costCenter?: string
    }
  | { action: "setHeadquarters"; groupId?: string; organizationId?: string }
  | { action: "removeUnit"; groupId?: string; organizationId?: string }
  | {
      action: "addMember"
      groupId?: string
      email?: string
      role?: CorporateGroupRole
    }
  | {
      action: "setMemberStatus"
      groupId?: string
      memberId?: string
      status?: "active" | "disabled"
    }

export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  if (!corporateRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as ActionBody | null
  if (!body?.action) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  }

  const ip = corporateRequestIp(request)

  try {
    if (body.action === "createGroup") {
      await createCorporateGroup(
        session,
        {
          name: body.name || "",
          headquartersOrganizationId: body.headquartersOrganizationId || "",
          organizationIds: Array.isArray(body.organizationIds) ? body.organizationIds : [],
        },
        ip,
      )
    } else if (body.action === "renameGroup") {
      if (!body.groupId) throw new Error("Grupo inválido.")
      await renameCorporateGroup(session, body.groupId, body.name || "", ip)
    } else if (body.action === "addUnit") {
      if (!body.groupId || !body.organizationId) throw new Error("Unidade inválida.")
      await addCorporateUnit(
        session,
        body.groupId,
        {
          organizationId: body.organizationId,
          unitCode: body.unitCode,
          costCenter: body.costCenter,
        },
        ip,
      )
    } else if (body.action === "setHeadquarters") {
      if (!body.groupId || !body.organizationId) throw new Error("Unidade inválida.")
      await setCorporateHeadquarters(session, body.groupId, body.organizationId, ip)
    } else if (body.action === "removeUnit") {
      if (!body.groupId || !body.organizationId) throw new Error("Unidade inválida.")
      await removeCorporateUnit(session, body.groupId, body.organizationId, ip)
    } else if (body.action === "addMember") {
      if (!body.groupId || !body.email || !body.role) throw new Error("Membro inválido.")
      await addCorporateMember(session, body.groupId, { email: body.email, role: body.role }, ip)
    } else if (body.action === "setMemberStatus") {
      if (!body.groupId || !body.memberId || !body.status) throw new Error("Membro inválido.")
      await setCorporateMemberStatus(session, body.groupId, body.memberId, body.status, ip)
    }

    return NextResponse.json({ ok: true, data: await getCorporateOverview(session) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir a ação corporativa." },
      { status: 400 },
    )
  }
}
