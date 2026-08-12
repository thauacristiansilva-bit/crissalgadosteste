"use client"

import { useState } from "react"
import { Clock3, Play, ShieldCheck, Store, UserRound } from "lucide-react"

type DemoMode = "public" | "trial"

export function DemoLauncher({ expired = false }: { expired?: boolean }) {
  const [loading, setLoading] = useState<DemoMode | null>(null)
  const [error, setError] = useState("")

  async function start(mode: DemoMode) {
    setLoading(mode)
    setError("")
    const response = await fetch(`/api/demo/${mode}/start`, { method: "POST" }).catch(() => null)
    if (!response) {
      setError("Não foi possível conectar ao servidor.")
      setLoading(null)
      return
    }
    const data = await response.json().catch(() => ({})) as {
      redirectTo?: string
      signInUrl?: string
      error?: string
    }
    if (!response.ok || !data.redirectTo) {
      setError(data.error || "Não foi possível iniciar a demonstração.")
      if (response.status === 401 && data.signInUrl) {
        window.setTimeout(() => { window.location.href = data.signInUrl! }, 1200)
      }
      setLoading(null)
      return
    }
    window.location.href = data.redirectTo
  }

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-10 text-[#2f1c13] sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700">
            <Store className="h-4 w-4" /> SaborFlow Demo
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Teste a operação de uma loja de verdade</h1>
          <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg">Pedidos, PDV, cozinha, entrega, caixa, clientes, cupons, complementos e estoque em um ambiente isolado com dados fictícios.</p>
        </div>

        {expired && <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Sua demonstração anterior expirou. Você pode iniciar um novo ambiente abaixo.</div>}
        {error && <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Play className="h-6 w-6" /></div>
            <h2 className="mt-5 text-2xl font-black">Demo pública</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Cria um ambiente exclusivo e temporário sem cadastro. Ideal para conhecer o fluxo completo agora.</p>
            <div className="mt-5 flex items-center gap-2 text-sm font-bold text-stone-700"><Clock3 className="h-4 w-4" /> 45 minutos por ambiente</div>
            <button type="button" disabled={Boolean(loading)} onClick={() => start("public")} className="mt-7 h-12 w-full rounded-2xl bg-[#d96d00] px-5 font-black text-white shadow-sm transition hover:brightness-95 disabled:opacity-50">{loading === "public" ? "Preparando demo..." : "Abrir demonstração"}</button>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><UserRound className="h-6 w-6" /></div>
            <h2 className="mt-5 text-2xl font-black">Trial individual</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Para quem já criou a conta comercial. O ambiente fica disponível por mais tempo e continua isolado da cobrança real.</p>
            <div className="mt-5 flex items-center gap-2 text-sm font-bold text-stone-700"><Clock3 className="h-4 w-4" /> 7 dias · reutiliza seu trial ativo</div>
            <button type="button" disabled={Boolean(loading)} onClick={() => start("trial")} className="mt-7 h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-5 font-black text-stone-900 transition hover:bg-stone-100 disabled:opacity-50">{loading === "trial" ? "Preparando trial..." : "Iniciar trial individual"}</button>
          </section>
        </div>

        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="font-black text-emerald-950">Ambiente seguro de demonstração</p><p className="mt-1 text-sm leading-6 text-emerald-800">Domínio próprio, impressão externa, cobrança real, emissão fiscal e integrações com efeitos externos ficam bloqueados. A expiração é validada pelo servidor.</p></div></div>
        </div>
      </div>
    </main>
  )
}
