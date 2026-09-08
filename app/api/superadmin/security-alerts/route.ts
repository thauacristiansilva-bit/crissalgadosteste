import { NextResponse } from "next/server"
import {
  listRecentSecurityAlerts,
  runSecurityAnomalyScan,
} from "@/lib/security/anomaly-alerts"
import {
  getSuperadminAccess,
} from "@/lib/superadmin-auth"
import {
  finiteNumber,
  InputValidationError,
  validationErrorStatus,
} from "@/lib/security/input-validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access =
    await getSuperadminAccess().catch(() => null)

  if (!access) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 403 },
    )
  }

  try {
    const url = new URL(request.url)
    const rawLimit =
      url.searchParams.get("limit")

    const limit =
      rawLimit === null
        ? 100
        : finiteNumber(
            rawLimit,
            "Limite",
            {
              min: 1,
              max: 200,
              integer: true,
            },
          )

    const alerts =
      await listRecentSecurityAlerts(limit)

    return NextResponse.json(
      {
        ok: true,
        alerts,
        summary: {
          total: alerts.length,
          critical:
            alerts.filter(
              (item) =>
                item.severity === "critical",
            ).length,
          high:
            alerts.filter(
              (item) =>
                item.severity === "high",
            ).length,
          warning:
            alerts.filter(
              (item) =>
                item.severity === "warning",
            ).length,
          notified:
            alerts.filter(
              (item) => item.notified,
            ).length,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os alertas.",
      },
      {
        status:
          error instanceof InputValidationError
            ? validationErrorStatus(error)
            : 500,
      },
    )
  }
}

export async function POST() {
  const access =
    await getSuperadminAccess().catch(() => null)

  if (!access || access.role !== "owner") {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 403 },
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
      "Falha na análise manual de segurança.",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          "Não foi possível executar a análise de segurança.",
      },
      { status: 500 },
    )
  }
}
