"use client"

import {
  FormEvent,
  useEffect,
  useState,
} from "react"
import { useRouter } from "next/navigation"

type ResetPreview = {
  name: string
  email: string
  expiresAt: string
}

export function PasswordResetForm({
  token,
}: {
  token: string
}) {
  const router = useRouter()
  const [preview, setPreview] =
    useState<ResetPreview | null>(
      null,
    )
  const [password, setPassword] =
    useState("")
  const [
    confirmation,
    setConfirmation,
  ] = useState("")
  const [message, setMessage] =
    useState("Validando link...")
  const [busy, setBusy] =
    useState(false)
  const [done, setDone] =
    useState(false)

  useEffect(() => {
    let active = true

    fetch(
      `/api/password-reset/${encodeURIComponent(
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
              "Link inválido.",
          )
        }

        if (active) {
          setPreview(data.reset)
          setMessage("")
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Link inválido.",
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

    if (password.length < 12) {
      return setMessage(
        "A senha precisa ter pelo menos 12 caracteres.",
      )
    }

    if (
      password !== confirmation
    ) {
      return setMessage(
        "As senhas não conferem.",
      )
    }

    setBusy(true)
    setMessage("")

    const response = await fetch(
      `/api/password-reset/${encodeURIComponent(
        token,
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      },
    )

    const data =
      await response.json()

    if (!response.ok) {
      setBusy(false)
      return setMessage(
        data.error ||
          "Não foi possível redefinir.",
      )
    }

    setDone(true)
    setBusy(false)
    setMessage(
      "Senha atualizada. As sessões antigas foram invalidadas.",
    )
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-12 text-[#2f1c13]">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#f0d0aa] bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#d96d00]">
          Plataforma SaborFlow
        </p>
        <h1 className="mt-3 text-2xl font-black">
          Redefinir senha
        </h1>

        {preview && (
          <div className="mt-5 rounded-2xl bg-[#fff8ef] p-4 text-sm">
            <strong>
              {preview.name}
            </strong>
            <p className="mt-1 text-gray-600">
              {preview.email}
            </p>
          </div>
        )}

        {preview && !done && (
          <form
            onSubmit={submit}
            className="mt-6 space-y-4"
          >
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              placeholder="Nova senha"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#d96d00]"
            />

            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              placeholder="Confirmar nova senha"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#d96d00]"
            />

            <button
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#d96d00] px-5 text-sm font-black text-white disabled:opacity-60"
            >
              {busy
                ? "Salvando..."
                : "Salvar nova senha"}
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
