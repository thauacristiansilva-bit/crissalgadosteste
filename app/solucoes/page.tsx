import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { MarketingCta, MarketingShell } from "@/components/marketing/marketing-shell"
import { MARKETING_SOLUTIONS } from "@/lib/marketing-content"

export const metadata: Metadata = { title: "Soluções — SaborFlow", description: "Soluções SaborFlow para venda online, PDV, produção, entrega e gestão." }

export default function SolutionsPage() {
  return (
    <MarketingShell>
      <main>
        <section className="px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pb-16 lg:pt-24">
          <div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Soluções</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-6xl">Uma operação contínua, do pedido ao resultado.</h1><p className="mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg">O SaborFlow conecta venda, produção, entrega e gestão para que a equipe trabalhe sobre o mesmo pedido e a mesma loja.</p></div>
        </section>
        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
            {MARKETING_SOLUTIONS.map((solution, index) => (
              <article key={solution.title} className="rounded-[28px] border border-orange-100 bg-white p-7 shadow-sm sm:p-8">
                <span className="text-xs font-black text-orange-600">0{index + 1}</span><h2 className="mt-3 text-2xl font-black text-stone-950">{solution.title}</h2><p className="mt-3 text-sm leading-6 text-stone-600">{solution.description}</p>
                <div className="mt-6 grid gap-2">{solution.points.map((point) => <p key={point} className="flex items-center gap-2 text-sm font-bold text-stone-700"><Check className="h-4 w-4 text-emerald-600" />{point}</p>)}</div>
              </article>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-7xl"><Link href="/demo" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">Ver tudo funcionando na demo <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
        <MarketingCta />
      </main>
    </MarketingShell>
  )
}
