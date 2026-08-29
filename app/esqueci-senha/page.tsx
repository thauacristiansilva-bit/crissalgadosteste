"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import {
  ArrowLeft,
  KeyRound,
  UserRound,
} from "lucide-react"

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()

    setBusy(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch(
        "/api/auth/password-reset/request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Não foi possível solicitar a recuperação.",
        )
      }

      setMessage(
        data.message ||
          "Se a conta existir, enviaremos as instruções para o e-mail cadastrado.",
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível solicitar a recuperação.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-5"
      style={{
        background:
          "linear-gradient(145deg, #fff9f1 0%, #fff1dc 52%, #f7e3cc 100%)",
      }}
    >
      <div
        className="absolute -left-20 -top-24 h-80 w-80 rounded-full blur-3xl"
        style={{
          backgroundColor: "rgba(245,158,11,.22)",
        }}
      />

      <div
        className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{
          backgroundColor: "rgba(60,36,21,.13)",
        }}
      />

      <div
        className="relative w-full max-w-lg rounded-[32px] border bg-white p-7 shadow-2xl sm:p-10"
        style={{
          borderColor: "#f0d0aa",
          boxShadow: "0 30px 80px rgba(60,36,21,.16)",
        }}
      >
        <div className="flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border bg-white p-1 shadow-md"
            style={{
              borderColor: "#f0d0aa",
            }}
          >
            <img
              src="/saborflow-brand.png"
              alt="SaborFlow"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p
            className="text-xs font-black uppercase tracking-[0.24em]"
            style={{
              color: "#d96d00",
            }}
          >
            Recuperação de acesso
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">
            Esqueceu sua senha?
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            Informe o CPF ou e-mail da sua conta SaborFlow.
            Se os dados estiverem cadastrados, enviaremos um
            link para redefinir sua senha.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
            {message}
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-7 space-y-5"
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
                value={identifier}
                onChange={(event) =>
                  setIdentifier(event.target.value)
                }
                placeholder="Digite seu CPF ou e-mail"
                className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, #d96d00 0%, #f59e0b 100%)",
            }}
          >
            <KeyRound className="h-4 w-4" />

            {busy
              ? "Enviando..."
              : "Enviar link de recuperação"}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-2 text-sm font-black text-[#3c2415] transition hover:text-[#d96d00]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>

        <p className="mt-6 text-center text-[11px] leading-5 text-gray-400">
          Por segurança, não informamos se um CPF ou e-mail
          está cadastrado no sistema.
        </p>
      </div>
    </main>
  )
}
