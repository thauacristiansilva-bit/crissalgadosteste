import { NextResponse } from "next/server"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canManageSecurity } from "@/lib/admin-access"
import { authenticatePrintAgent } from "@/lib/organization-security-db"
import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!integrationsRequestIsSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 })
  const session = await getVerifiedTenantSession()
  if (!session || !canManageSecurity(session.role, session.operationalPermissions)) return NextResponse.json({ error: "Sem acesso." }, { status: session ? 403 : 401 })
  const body = await request.json().catch(() => null) as { token?: string; platform?: string } | null
  const token = body?.token || ""
  if (!/^sfpa_[a-zA-Z0-9_-]{35,100}$/.test(token)) return NextResponse.json({ error: "Código inválido." }, { status: 400 })
  const agent = await authenticatePrintAgent(token)
  if (!agent || agent.organizationId !== session.organizationId) return NextResponse.json({ error: "Conexão não encontrada." }, { status: 403 })
  const base = process.env.APP_BASE_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin
  let origin: string
  try { const parsed = new URL(base); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); origin = parsed.origin } catch { return NextResponse.json({ error: "Configure APP_BASE_URL HTTPS no servidor." }, { status: 503 }) }
  if (body?.platform === "mac" || body?.platform === "linux") {
    const template = await readFile(join(process.cwd(), "INICIAR-IMPRESSAO-AUTOMATICA-UNIX.sh"), "utf8")
    const script = template.replace("__SABORFLOW_URL__", JSON.stringify(origin)).replace("__SABORFLOW_TOKEN__", JSON.stringify(token))
    return new NextResponse(script, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="CONECTAR-IMPRESSORA-SABORFLOW.sh"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
  }
  if (body?.platform && body.platform !== "windows") return NextResponse.json({ error: "Sistema operacional inválido." }, { status: 400 })
  const script = [
    "@echo off",
    "title SaborFlow - Impressora",
    `set "SABORFLOW_URL=${origin}"`,
    `set "SABORFLOW_TOKEN=${token}"`,
    "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"$ErrorActionPreference='Stop'; $p=Join-Path $env:TEMP 'SaborFlow-Impressao.ps1'; Invoke-WebRequest -UseBasicParsing ($env:SABORFLOW_URL + '/api/print-agent/script') -OutFile $p; & $p -ServerUrl $env:SABORFLOW_URL -Token $env:SABORFLOW_TOKEN\"",
    "echo O conector foi fechado. Pressione qualquer tecla para sair.",
    "pause >nul",
  ].join("\r\n")
  return new NextResponse(script, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="CONECTAR-IMPRESSORA-SABORFLOW.cmd"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
}
