import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export async function GET() {
  const source = await readFile(join(process.cwd(), "INICIAR-IMPRESSAO-AUTOMATICA.ps1"), "utf8")
  return new NextResponse(source, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}
