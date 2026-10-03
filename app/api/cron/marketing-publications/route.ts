import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { runDueMarketingPublications } from "@/lib/marketing-auto-publisher"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorized(request: Request) {
  const expected = String(process.env.CRON_SECRET || "")
  const received = String(
    request.headers.get("authorization") || "",
  ).replace(/^Bearer\s+/i, "")

  if (!expected || !received) return false

  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Cron nao autorizado." },
      { status: 401 },
    )
  }

  try {
    const result = await runDueMarketingPublications(15)
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error("[cron:marketing-publications]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : "Falha no processamento das publicacoes.",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}
