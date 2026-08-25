"use client"

import Script from "next/script"
import { FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [googleReady, setGoogleReady] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar.")
      router.replace("/admin")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.")
    } finally {
      setBusy(false)
    }
  }

  async function googleLogin(credential: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar com Google.")
      router.replace("/admin")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar com Google.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!googleReady || !googleClientId || !googleButtonRef.current || !window.google) return
    googleButtonRef.current.innerHTML = ""
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response: { credential: string }) => void googleLogin(response.credential),
    })
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 420,
      shape: "rectangular",
      text: "signin_with",
      locale: "pt-BR",
    })
  }, [googleReady, googleClientId])

  return (
    <div className="mt-7">
      {googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}

      {googleClientId && (
        <>
          <div ref={googleButtonRef} className="flex min-h-11 justify-center" />
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">ou entre com sua senha</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">E-mail</span>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Senha</span>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-11 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Digite sua senha" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <button disabled={busy} type="submit" className="h-12 w-full rounded-xl text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #d96d00 0%, #f59e0b 100%)" }}>
          {busy ? "Entrando..." : "Entrar no painel"}
        </button>
      </form>

      {googleClientId && (
        <p className="mt-4 text-center text-[11px] leading-4 text-gray-400">
          O Google funciona para contas criadas ou já vinculadas ao Google no SaborFlow.
        </p>
      )}
    </div>
  )
}
