"use client"

import Link from "next/link"
import Script from "next/script"
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser"
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  useRouter,
} from "next/navigation"
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react"

type TwoFactorMode =
  | "setup"
  | "verify"

type LoginStep =
  | "credentials"
  | "twoFactor"
  | "recoveryCodes"

type SetupInfo = {
  issuer: string
  account: string
  manualKey: string
}

export function LoginForm() {
  const router = useRouter()

  const [
    identifier,
    setIdentifier,
  ] = useState("")

  const [
    password,
    setPassword,
  ] = useState("")

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [
    busy,
    setBusy,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState("")

  const [
    googleReady,
    setGoogleReady,
  ] = useState(false)

  const [
    step,
    setStep,
  ] =
    useState<LoginStep>(
      "credentials",
    )

  const [
    twoFactorMode,
    setTwoFactorMode,
  ] =
    useState<TwoFactorMode>(
      "verify",
    )

  const [
    twoFactorCode,
    setTwoFactorCode,
  ] = useState("")

  const [
    setupInfo,
    setSetupInfo,
  ] =
    useState<SetupInfo | null>(
      null,
    )

  const [
    recoveryCodes,
    setRecoveryCodes,
  ] = useState<string[]>([])

  const [
    finalRedirect,
    setFinalRedirect,
  ] = useState("/admin")

  const googleButtonRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const googleClientId =
    process.env
      .NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ""

  const [
    passkeyAvailable,
    setPasskeyAvailable,
  ] = useState(false)

  const [
    passkeySupported,
    setPasskeySupported,
  ] = useState(false)

  async function loadPasskeyAvailability() {
    const supported =
      browserSupportsWebAuthn()

    setPasskeySupported(
      supported,
    )

    if (!supported) {
      setPasskeyAvailable(
        false,
      )
      return
    }

    const response =
      await fetch(
        "/api/auth/passkey/options",
        {
          method: "GET",
          cache: "no-store",
        },
      ).catch(() => null)

    if (!response?.ok) {
      setPasskeyAvailable(
        false,
      )
      return
    }

    const data =
      await response
        .json()
        .catch(() => null)

    setPasskeyAvailable(
      Boolean(
        data?.available,
      ),
    )
  }

  async function loadSetupInfo() {
    const response =
      await fetch(
        "/api/auth/2fa/setup",
        {
          method: "GET",
          cache: "no-store",
        },
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Não foi possível preparar o 2FA.",
      )
    }

    setSetupInfo({
      issuer:
        String(
          data.issuer ||
            "SaborFlow",
        ),
      account:
        String(
          data.account ||
            "",
        ),
      manualKey:
        String(
          data.manualKey ||
            "",
        ),
    })
  }

  async function beginTwoFactor(
    data: {
      twoFactorMode?: string
    },
  ) {
    const mode:
      TwoFactorMode =
      data.twoFactorMode ===
      "setup"
        ? "setup"
        : "verify"

    setTwoFactorMode(mode)
    setTwoFactorCode("")
    setSetupInfo(null)
    setStep("twoFactor")

    if (mode === "setup") {
      setPasskeyAvailable(false)
      await loadSetupInfo()
      return
    }

    await loadPasskeyAvailability()
  }

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              identifier,
              password,
            }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Não foi possível entrar.",
        )
      }

      if (
        data.requiresTwoFactor
      ) {
        await beginTwoFactor(
          data,
        )
        return
      }

      const redirectTo =
        typeof data.redirectTo ===
          "string" &&
        data.redirectTo.startsWith(
          "/",
        )
          ? data.redirectTo
          : "/admin"

      router.replace(
        redirectTo,
      )
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao entrar.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function googleLogin(
    credential: string,
  ) {
    setBusy(true)
    setError("")

    try {
      const response =
        await fetch(
          "/api/auth/google",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                credential,
              }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Não foi possível entrar com Google.",
        )
      }

      if (
        data.requiresTwoFactor
      ) {
        await beginTwoFactor(
          data,
        )
        return
      }

      const redirectTo =
        typeof data.redirectTo ===
          "string" &&
        data.redirectTo.startsWith(
          "/",
        )
          ? data.redirectTo
          : "/admin"

      router.replace(
        redirectTo,
      )
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível entrar com Google.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function authenticateWithPasskey() {
    setBusy(true)
    setError("")

    try {
      if (
        !browserSupportsWebAuthn()
      ) {
        throw new Error(
          "Este navegador não oferece suporte a Passkeys/WebAuthn.",
        )
      }

      const optionsResponse =
        await fetch(
          "/api/auth/passkey/options",
          {
            method: "POST",
          },
        )

      const optionsData =
        await optionsResponse
          .json()
          .catch(() => null)

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData?.error ||
            "Não foi possível iniciar a Passkey.",
        )
      }

      const authenticationResponse =
        await startAuthentication({
          optionsJSON:
            optionsData.options,
        })

      const verifyResponse =
        await fetch(
          "/api/auth/passkey/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              response:
                authenticationResponse,
            }),
          },
        )

      const verifyData =
        await verifyResponse
          .json()
          .catch(() => null)

      if (!verifyResponse.ok) {
        throw new Error(
          verifyData?.error ||
            "Não foi possível validar a Passkey.",
        )
      }

      const redirectTo =
        typeof verifyData?.redirectTo ===
          "string" &&
        verifyData.redirectTo.startsWith(
          "/",
        )
          ? verifyData.redirectTo
          : "/admin"

      router.replace(
        redirectTo,
      )
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível usar a Passkey."

      setError(
        message.includes(
          "The operation either timed out or was not allowed",
        ) ||
          message.includes(
            "NotAllowedError",
          )
          ? "A autenticação com Passkey foi cancelada ou expirou."
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  async function submitTwoFactor(
    event: FormEvent,
  ) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const response =
        await fetch(
          "/api/auth/2fa/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                code:
                  twoFactorCode,
              }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Não foi possível validar o código.",
        )
      }

      const redirectTo =
        typeof data.redirectTo ===
          "string" &&
        data.redirectTo.startsWith(
          "/",
        )
          ? data.redirectTo
          : "/admin"

      if (
        Array.isArray(
          data.recoveryCodes,
        ) &&
        data.recoveryCodes.length >
          0
      ) {
        setRecoveryCodes(
          data.recoveryCodes.map(
            String,
          ),
        )
        setFinalRedirect(
          redirectTo,
        )
        setStep(
          "recoveryCodes",
        )
        return
      }

      router.replace(
        redirectTo,
      )
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível validar o 2FA.",
      )
    } finally {
      setBusy(false)
    }
  }

  function returnToLogin() {
    setStep(
      "credentials",
    )
    setTwoFactorCode("")
    setSetupInfo(null)
    setRecoveryCodes([])
    setPasskeyAvailable(false)
    setError("")
  }

  async function copyText(
    value: string,
  ) {
    try {
      await navigator.clipboard.writeText(
        value,
      )
    } catch {
      // O valor continua visível para cópia manual.
    }
  }

  useEffect(() => {
    if (
      step !==
        "credentials" ||
      !googleReady ||
      !googleClientId ||
      !googleButtonRef.current ||
      !window.google
    ) {
      return
    }

    googleButtonRef.current.innerHTML =
      ""

    window.google.accounts.id.initialize(
      {
        client_id:
          googleClientId,
        callback: (
          response: {
            credential: string
          },
        ) =>
          void googleLogin(
            response.credential,
          ),
      },
    )

    window.google.accounts.id.renderButton(
      googleButtonRef.current,
      {
        theme: "outline",
        size: "large",
        width: 420,
        shape: "rectangular",
        text: "signin_with",
        locale: "pt-BR",
      },
    )
  }, [
    googleReady,
    googleClientId,
    step,
  ])

  return (
    <div className="mt-7">
      {googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() =>
            setGoogleReady(
              true,
            )
          }
        />
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {step ===
        "recoveryCodes" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-black text-emerald-950">
                2FA ativado com sucesso
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Guarde os códigos abaixo em um lugar seguro. Cada código de recuperação funciona apenas uma vez.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recoveryCodes.map(
              (code) => (
                <code
                  key={code}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm font-black tracking-wide text-gray-800"
                >
                  {code}
                </code>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              void copyText(
                recoveryCodes.join(
                  "\n",
                ),
              )
            }
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-black text-gray-700 transition hover:bg-gray-50"
          >
            <Copy className="h-4 w-4" />
            Copiar códigos
          </button>

          <button
            type="button"
            onClick={() => {
              router.replace(
                finalRedirect,
              )
              router.refresh()
            }}
            className="h-12 w-full rounded-xl text-sm font-black text-white shadow-sm transition hover:brightness-105"
            style={{
              background:
                "linear-gradient(135deg, #d96d00 0%, #f59e0b 100%)",
            }}
          >
            Continuar para o painel
          </button>
        </div>
      )}

      {step ===
        "twoFactor" && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-xl font-black text-gray-950">
              {twoFactorMode ===
              "setup"
                ? "Ative a autenticação em duas etapas"
                : "Confirme sua identidade"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              {twoFactorMode ===
              "setup"
                ? "Use Google Authenticator, Microsoft Authenticator, Authy ou outro aplicativo compatível com TOTP."
                : "Digite o código atual do seu aplicativo autenticador ou um código de recuperação."}
            </p>
          </div>

          {twoFactorMode ===
            "setup" && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-2xl border border-gray-200 bg-white p-4">
                <img
                  src="/api/auth/2fa/qr"
                  alt="QR Code para configurar o 2FA do SaborFlow"
                  width={240}
                  height={240}
                  className="h-60 w-60"
                />
              </div>

              {setupInfo && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                    Chave manual
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all text-xs font-black text-gray-800">
                      {
                        setupInfo.manualKey
                      }
                    </code>

                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          setupInfo.manualKey.replace(
                            /\s/g,
                            "",
                          ),
                        )
                      }
                      className="rounded-lg p-2 text-gray-500 transition hover:bg-white hover:text-gray-900"
                      aria-label="Copiar chave manual"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-gray-500">
                    Conta:{" "}
                    {
                      setupInfo.account
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={
              submitTwoFactor
            }
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {twoFactorMode ===
                "setup"
                  ? "Código de 6 dígitos"
                  : "Código de autenticação"}
              </span>

              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  required
                  autoFocus
                  type="text"
                  inputMode={
                    twoFactorMode ===
                    "setup"
                      ? "numeric"
                      : "text"
                  }
                  autoComplete="one-time-code"
                  value={
                    twoFactorCode
                  }
                  onChange={(
                    event,
                  ) =>
                    setTwoFactorCode(
                      twoFactorMode ===
                        "setup"
                        ? event.target.value
                            .replace(
                              /\D/g,
                              "",
                            )
                            .slice(
                              0,
                              6,
                            )
                        : event.target.value
                            .toUpperCase()
                            .slice(
                              0,
                              30,
                            ),
                    )
                  }
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-center text-lg font-black tracking-[0.25em] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder={
                    twoFactorMode ===
                    "setup"
                      ? "000000"
                      : "000000"
                  }
                />
              </div>
            </label>

            <button
              disabled={busy}
              type="submit"
              className="h-12 w-full rounded-xl text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #d96d00 0%, #f59e0b 100%)",
              }}
            >
              {busy
                ? "Validando..."
                : twoFactorMode ===
                    "setup"
                  ? "Ativar 2FA"
                  : "Confirmar código"}
            </button>
          </form>

          {twoFactorMode ===
            "verify" &&
            passkeySupported &&
            passkeyAvailable && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    ou
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void authenticateWithPasskey()
                  }
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  Usar Passkey / Windows Hello
                </button>

                <p className="text-center text-[11px] leading-4 text-gray-400">
                  Também funciona com biometria do dispositivo e chaves de segurança FIDO2 cadastradas.
                </p>
              </div>
            )}

          <button
            type="button"
            onClick={
              returnToLogin
            }
            className="w-full text-center text-xs font-black text-gray-500 underline-offset-4 transition hover:text-gray-800 hover:underline"
          >
            Voltar ao login
          </button>
        </div>
      )}

      {step ===
        "credentials" && (
        <>
          {googleClientId && (
            <>
              <div
                ref={
                  googleButtonRef
                }
                className="flex min-h-11 justify-center"
              />

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  ou entre com sua senha
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            </>
          )}

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                CPF ou e-mail
              </span>

              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  required
                  type="text"
                  autoComplete="username"
                  value={
                    identifier
                  }
                  onChange={(
                    event,
                  ) =>
                    setIdentifier(
                      event.target.value,
                    )
                  }
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="Digite seu CPF ou e-mail"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Senha
              </span>

              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  required
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  value={
                    password
                  }
                  onChange={(
                    event,
                  ) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-11 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="Digite sua senha"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (value) =>
                        !value,
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label={
                    showPassword
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <Link
                href="/esqueci-senha"
                className="text-xs font-black text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>

            <button
              disabled={busy}
              type="submit"
              className="h-12 w-full rounded-xl text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #d96d00 0%, #f59e0b 100%)",
              }}
            >
              {busy
                ? "Entrando..."
                : "Entrar no painel"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] leading-4 text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              O segundo fator de autenticação é obrigatório para o acesso administrativo.
            </span>
          </div>

          <p className="mt-3 text-center text-[11px] leading-4 text-gray-400">
            Você pode entrar com o CPF cadastrado ou com o e-mail da sua conta.
          </p>

          {googleClientId && (
            <p className="mt-2 text-center text-[11px] leading-4 text-gray-400">
              O Google funciona para contas criadas ou já vinculadas ao Google no SaborFlow e também exige 2FA.
            </p>
          )}
        </>
      )}
    </div>
  )
}
