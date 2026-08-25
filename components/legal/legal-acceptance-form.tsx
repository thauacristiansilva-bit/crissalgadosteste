"use client"

import Link from "next/link"
import { useState } from "react"
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"

export function LegalAcceptanceForm() {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (!accepted || busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar o aceite.")
      router.replace("/admin")
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar o aceite.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-xl sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-3xl font-black tracking-tight text-stone-950">Documentos atualizados</h1>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Antes de continuar no painel, leia os documentos atuais do SaborFlow. O registro guarda a versão aceita, data, origem técnica e informações de segurança do acesso.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/termos" target="_blank" className="rounded-2xl border border-stone-200 p-4 transition hover:border-orange-300 hover:bg-orange-50/40">
          <p className="font-black text-stone-900">Termos de Uso</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Regras de uso, conta, cobrança, responsabilidades e disponibilidade.</p>
        </Link>
        <Link href="/privacidade" target="_blank" className="rounded-2xl border border-stone-200 p-4 transition hover:border-orange-300 hover:bg-orange-50/40">
          <p className="font-black text-stone-900">Aviso de Privacidade</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Como dados pessoais são utilizados, protegidos, compartilhados e retidos.</p>
        </Link>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" />
        <span>Li e concordo com os <Link href="/termos" target="_blank" className="font-black text-orange-700 underline">Termos de Uso</Link> e declaro ciência do <Link href="/privacidade" target="_blank" className="font-black text-orange-700 underline">Aviso de Privacidade</Link>.</span>
      </label>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}

      <button type="button" disabled={!accepted || busy} onClick={() => void submit()} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {busy ? "Registrando..." : "Aceitar e continuar"}
      </button>
    </div>
  )
}
