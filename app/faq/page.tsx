import type { Metadata } from "next"
import { MarketingCta, MarketingShell } from "@/components/marketing/marketing-shell"
import { MARKETING_FAQ } from "@/lib/marketing-content"

export const metadata: Metadata = { title: "FAQ — SaborFlow", description: "Perguntas frequentes sobre o SaborFlow, demonstração, planos e operação." }

export default function FaqPage() {
  return (
    <MarketingShell><main>
      <section className="px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pb-16 lg:pt-24"><div className="mx-auto max-w-5xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">FAQ</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-6xl">Perguntas frequentes.</h1><p className="mt-5 max-w-3xl text-base leading-7 text-stone-600">Respostas diretas sobre contratação, demonstração, multiempresa e operação.</p></div></section>
      <section className="px-4 pb-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl space-y-3">{MARKETING_FAQ.map((item) => <details key={item.question} className="group rounded-2xl border border-orange-100 bg-white p-5 sm:p-6"><summary className="flex list-none items-center justify-between gap-4 text-base font-black text-stone-900 [&::-webkit-details-marker]:hidden"><span>{item.question}</span><span className="text-xl text-orange-600 transition group-open:rotate-45">+</span></summary><p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">{item.answer}</p></details>)}</div></section>
      <MarketingCta />
    </main></MarketingShell>
  )
}
