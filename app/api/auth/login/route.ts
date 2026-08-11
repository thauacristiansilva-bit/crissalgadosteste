import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  createSessionToken,
  credentialsAreValid,
  legacyAdminLoginAllowed,
} from "@/lib/auth"
import {
  authenticateAdminUser,
  getAdminUserCredentialState,
  upgradeLegacyAdminPassword,
} from "@/lib/admin-user-db"
import {
  getDefaultAdminTenantContext,
  getDefaultAdminTenantContextForUserId,
} from "@/lib/tenant-context"

function setSessionCookies(
  response: NextResponse,
  token: string,
) {
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        60 * 60 * 24 * 7,
    },
  )

  response.cookies.set(
    LEGACY_ADMIN_SESSION_COOKIE,
    "",
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge: 0,
    },
  )
}

export async function POST(
  request: Request,
) {
  const body = (await request
    .json()
    .catch(() => null)) as
    | {
        email?: string
        password?: string
      }
    | null

  if (
    !body?.email ||
    !body?.password
  ) {
    return NextResponse.json(
      {
        error:
          "E-mail ou senha inválidos.",
      },
      { status: 401 },
    )
  }

  const email =
    body.email.trim()
  const password =
    body.password

  try {
    const credentialState =
      await getAdminUserCredentialState(
        email,
      )

    if (
      credentialState &&
      !credentialState.active
    ) {
      return NextResponse.json(
        {
          error:
            "E-mail ou senha inválidos.",
        },
        { status: 401 },
      )
    }

    if (
      credentialState?.passwordReady
    ) {
      const user =
        await authenticateAdminUser(
          email,
          password,
        )

      if (!user) {
        return NextResponse.json(
          {
            error:
              "E-mail ou senha inválidos.",
          },
          { status: 401 },
        )
      }

      const tenantContext =
        await getDefaultAdminTenantContextForUserId(
          user.id,
        )

      if (!tenantContext) {
        return NextResponse.json(
          {
            error:
              "Sua conta não possui uma empresa ativa.",
          },
          { status: 403 },
        )
      }

      const response =
        NextResponse.json({
          ok: true,
          sessionMode: "tenant",
          authSource:
            "postgres",
        })

      setSessionCookies(
        response,
        createSessionToken(
          tenantContext,
        ),
      )

      return response
    }

    if (
      !legacyAdminLoginAllowed()
    ) {
      return NextResponse.json(
        {
          error:
            "Login PostgreSQL ainda não foi preparado para esta conta.",
        },
        { status: 503 },
      )
    }

    if (
      !credentialsAreValid(
        email,
        password,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "E-mail ou senha inválidos.",
        },
        { status: 401 },
      )
    }

    let tenantContext =
      await getDefaultAdminTenantContext(
        email,
      )

    if (
      tenantContext &&
      process.env.ADMIN_PASSWORD
    ) {
      await upgradeLegacyAdminPassword(
        email,
        password,
      ).catch((error) => {
        console.error(
          "[SaborFlow] Login válido, mas não foi possível promover a senha para PostgreSQL:",
          error instanceof Error
            ? error.message
            : error,
        )
      })

      tenantContext =
        await getDefaultAdminTenantContext(
          email,
        )
    }

    const response =
      NextResponse.json({
        ok: true,
        sessionMode:
          tenantContext
            ? "tenant"
            : "legacy",
        authSource:
          "legacy-transition",
      })

    setSessionCookies(
      response,
      createSessionToken(
        tenantContext,
      ),
    )

    return response
  } catch (error) {
    if (
      legacyAdminLoginAllowed() &&
      credentialsAreValid(
        email,
        password,
      )
    ) {
      console.error(
        "[SaborFlow] PostgreSQL indisponível no login; usando transição legada:",
        error instanceof Error
          ? error.message
          : error,
      )

      let tenantContext = null

      try {
        tenantContext =
          await getDefaultAdminTenantContext(
            email,
          )
      } catch {
        tenantContext = null
      }

      const response =
        NextResponse.json({
          ok: true,
          sessionMode:
            tenantContext
              ? "tenant"
              : "legacy",
          authSource:
            "legacy-fallback",
        })

      setSessionCookies(
        response,
        createSessionToken(
          tenantContext,
        ),
      )

      return response
    }

    return NextResponse.json(
      {
        error:
          "Não foi possível validar o login.",
      },
      { status: 503 },
    )
  }
}
