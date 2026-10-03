import { NextResponse } from "next/server"
import { getSuperadminAccess } from "@/lib/superadmin-auth"
import { getPlatformInsights } from "@/lib/superadmin-platform-insights"

export const dynamic = "force-dynamic"

export async function GET() {
  const access = await getSuperadminAccess()
  if (!access) return NextResponse.json({ error: "Não autorizado." }, { status: 403 })

  return NextResponse.json({
    ok: true,
    data: await getPlatformInsights(),
  })
}
