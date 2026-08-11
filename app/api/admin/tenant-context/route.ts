import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth"
import { membershipExists } from "@/lib/tenant-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getAdminSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 },
    )
  }

  if (session.mode === "legacy") {
    return NextResponse.json({
      ok: true,
      sessionMode: "legacy",
      email: session.email,
      organization: null,
      message:
        "Login ainda está em modo legado. Execute o bootstrap da primeira organização e faça login novamente.",
    })
  }

  const activeMembership = await membershipExists(
    session.userId,
    session.organizationId,
  )

  return NextResponse.json({
    ok: activeMembership,
    sessionMode: "tenant",
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
    },
    organization: {
      id: session.organizationId,
      name: session.organizationName,
      slug: session.organizationSlug,
    },
    activeMembership,
  })
}
