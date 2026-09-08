import {
  createHash,
  timingSafeEqual,
} from "node:crypto"
import { NextResponse } from "next/server"
import { runSecurityAnomalyScan } from "@/lib/security/anomaly-alerts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function tokenMatches(request: Request) {
  const expected =
    process.env.SECURITY_ALERTS_CRON_TOKEN?.trim() || ""

  if (!expected) {
    return {
      configured: false,
      valid: false,
    }
  }

  const authorization =
    request.headers.get("authorization") || ""

  const supplied =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : ""

  if (!supplied) {
    return {
      configured: true,
      valid: false,
    }
  }

  const left = createHash("sha256")
    .update(supplied)
    .digest()
  const right = createHash("sha256")
    .update(expected)
    .digest()

  return {
    configured: true,
    valid:
      left.length === right.length &&
      timingSafeEqual(left, right),
  }
}

export async function GET(request: Request) {
  const auth = tokenMatches(request)

  if (!auth.configured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SECURITY_ALERTS_CRON_TOKEN não configurado.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  }

  if (!auth.valid) {
    return NextResponse.json(
      {
        ok: false,
        error: "Não autorizado.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  }

  try {
    const result =
      await runSecurityAnomalyScan()

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  } catch (error) {
    console.error(
      "Falha no scanner de anomalias de segurança.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          "Não foi possível executar a análise de segurança.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  }
}
