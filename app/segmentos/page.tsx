import type { Metadata } from "next"
import { ArrowRight, Store } from "lucide-react"
import Link from "next/link"
import { MarketingCta, MarketingShell } from "@/components/marketing/marketing-shell"
import { MARKETING_SEGMENTS } from "@/lib/marketing-content"

export const metadata: Metadata = { title: "Segmentos — SaborFlow", description: "SaborFlow para restaurantes, lanchonetes, pizzarias, padarias, dark kitchens e outros negócios de alimentação." }

export default function SegmentsPage() {
  return (
    <MarketingShell><main>
      <section className="px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pb-16 lg:pt-24"><div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Segmentos</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-6xl">Feito para quem produz, vende e entrega comida todos os dias.</h1><p className="mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg">A mesma base pode se adaptar a diferentes operações, preservando cardápio, pedidos, produção, estoque e gestão por loja.</p></div></section>
      <section className="px-4 pb-20 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-3">{MARKETING_SEGMENTS.map((segment) => <div key={segment} className="flex items-center gap-4 rounded-2xl border border-orange-100 bg-white p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Store className="h-5 w-5" /></div><span className="text-base font-black text-stone-800">{segment}</span></div>)}</div><div className="mx-auto mt-8 max-w-7xl"><Link href="/demo" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">Testar com uma operação fictícia <ArrowRight className="h-4 w-4" /></Link></div></section>
      <MarketingCta />
    </main></MarketingShell>
  )
}
