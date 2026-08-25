"use client"

import {
  FormEvent,
  useEffect,
  useState,
} from "react"
import { useRouter } from "next/navigation"

type Invitation = {
  name: string
  email: string
  role: string
  organizationName: string
  organizationSlug: string
  passwordRequired: boolean
  expiresAt: string
}

export function InvitationAcceptance({
  token,
}: {
  token: string
}) {
  const router = useRouter()
  const [
    invitation,
    setInvitation,
  ] = useState<Invitation | null>(
    null,
  )
  const [password, setPassword] =
    useState("")
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("")
  const [message, setMessage] =
    useState("Carregando convite...")
  const [busy, setBusy] =
    useState(false)
  const [done, setDone] =
    useState(false)

  useEffect(() => {
    let active = true

    fetch(
      `/api/invitations/${encodeURIComponent(
        token,
      )}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const data =
          await response.json()

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Convite inválido.",
          )
        }

        if (active) {
          setInvitation(
            data.invitation,
          )
          setMessage("")
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Convite inválido.",
          )
        }
      })

    return () => {
      active = false
    }
  }, [token])

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault()

    if (
      invitation?.passwordRequired
    ) {
      if (password.length < 12) {
        return setMessage(
          "A senha precisa ter pelo menos 12 caracteres.",
        )
      }

      if (
        password !==
        confirmPassword
      ) {
        return setMessage(
          "As senhas não conferem.",
        )
      }
    }

    setBusy(true)
    setMessage("")

    const response = await fetch(
      `/api/invitations/${encodeURIComponent(
        token,
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          password:
            invitation?.passwordRequired
              ? password
              : undefined,
        }),
      },
    )

    const data =
      await response.json()

    if (!response.ok) {
      setBusy(false)
      return setMessage(
        data.error ||
          "Não foi possível aceitar.",
      )
    }

    setDone(true)
    setBusy(false)
    setMessage(
      "Acesso ativado. Você já pode entrar no SaborFlow.",
    )
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-12 text-[#2f1c13]">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#f0d0aa] bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#d96d00]">
          Plataforma SaborFlow
        </p>

        <h1 className="mt-3 text-2xl font-black">
          Convite para equipe
        </h1>

        {invitation && (
          <div className="mt-5 rounded-2xl bg-[#fff8ef] p-4 text-sm">
            <p>
              <strong>
                {invitation.name}
              </strong>
            </p>
            <p className="mt-1 text-gray-600">
              {invitation.email}
            </p>
            <p className="mt-3">
              Empresa:{" "}
              <strong>
                {
                  invitation.organizationName
                }
              </strong>
            </p>
            <p className="mt-1">
              Perfil:{" "}
              <strong>
                {invitation.role}
              </strong>
            </p>
          </div>
        )}

        {invitation && !done && (
          <form
            onSubmit={submit}
            className="mt-6 space-y-4"
          >
            {invitation.passwordRequired ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-gray-500">
                    Criar senha
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#d96d00]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-gray-500">
                    Confirmar senha
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={
                      confirmPassword
                    }
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#d96d00]"
                  />
                </label>
              </>
            ) : (
              <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                Este e-mail já possui
                conta SaborFlow. Ao aceitar,
                use sua senha atual no login.
              </p>
            )}

            <button
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#d96d00] px-5 text-sm font-black text-white disabled:opacity-60"
            >
              {busy
                ? "Ativando..."
                : "Aceitar convite"}
            </button>
          </form>
        )}

        {message && (
          <p
            className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
              done
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {message}
          </p>
        )}

        {done && (
          <button
            onClick={() =>
              router.replace("/login")
            }
            className="mt-5 h-12 w-full rounded-xl bg-[#2f1c13] px-5 text-sm font-black text-white"
          >
            Ir para o login
          </button>
        )}
      </div>
    </main>
  )
}
