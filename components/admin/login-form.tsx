"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"

export function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter()
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

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

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">E-mail</span>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Senha</span>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-11 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Digite sua senha" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      <button disabled={busy} type="submit" className="h-12 w-full rounded-xl bg-blue-700 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50">
        {busy ? "Entrando..." : "Entrar no painel"}
      </button>
    </form>
  )
}
