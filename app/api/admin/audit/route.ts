import { NextResponse } from "next/server"
import { canManageOrganizationSettings } from "@/lib/tenant-permissions"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { listTenantAuditEvents } from "@/lib/security/audit-log"
import {
  finiteNumber,
  InputValidationError,
  optionalText,
  validationErrorStatus,
} from "@/lib/security/input-validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FILTER_OPTIONS = {
  maxLength: 100,
  allowNewlines: false,
  pattern: /^[A-Za-z0-9._-]+$/,
} as const

export async function GET(request: Request) {
  const session = await getVerifiedTenantSession().catch(() => null)

  if (!session) {
    return NextResponse.json(
      { error: "Sessão administrativa inválida." },
      { status: 401 },
    )
  }

  if (!canManageOrganizationSettings(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil não pode consultar a trilha de auditoria." },
      { status: 403 },
    )
  }

  try {
    const url = new URL(request.url)
    const rawLimit = url.searchParams.get("limit")
    const limit = rawLimit === null
      ? 100
      : finiteNumber(rawLimit, "Limite", {
          min: 1,
          max: 200,
          integer: true,
        })

    const actionPrefix = optionalText(
      url.searchParams.get("action"),
      "Ação",
      FILTER_OPTIONS,
    )

    const category = optionalText(
      url.searchParams.get("category"),
      "Categoria",
      FILTER_OPTIONS,
    )

    const events = await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      () =>
        listTenantAuditEvents({
          organizationId: session.organizationId,
          limit,
          actionPrefix,
          category,
        }),
      "tenant-session",
    )

    return NextResponse.json(
      { ok: true, events },
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
            : "Não foi possível consultar a auditoria.",
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
