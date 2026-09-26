import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageSecurity } from "@/lib/admin-access"

export const runtime = "nodejs"

export async function GET() {
  const session = await getVerifiedTenantSession()
  if (!session || !canManageSecurity(session.role, session.operationalPermissions)) return NextResponse.json({ error: "Não autorizado." }, { status: session ? 403 : 401 })
  const file = await readFile(join(process.cwd(), "INICIAR-IMPRESSAO-AUTOMATICA.ps1"), "utf8")
  return new NextResponse(file, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="INICIAR-IMPRESSAO-AUTOMATICA.ps1"', "Cache-Control": "no-store" } })
}
