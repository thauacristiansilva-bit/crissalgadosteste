import type { Metadata } from "next"
import { MarketingCta, MarketingShell } from "@/components/marketing/marketing-shell"
import { MarketingIcon, type MarketingIconName } from "@/components/marketing/marketing-icons"
import { MARKETING_FEATURES } from "@/lib/marketing-content"

export const metadata: Metadata = { title: "Recursos — SaborFlow", description: "Conheça os recursos do SaborFlow para pedidos, PDV, cozinha, delivery, estoque e gestão." }

export default function ResourcesPage() {
  return (
    <MarketingShell><main>
      <section className="px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pb-16 lg:pt-24"><div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Recursos</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-6xl">Ferramentas que compartilham o mesmo contexto.</h1><p className="mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg">Em vez de módulos desconectados, o SaborFlow organiza os recursos em torno da operação real da loja.</p></div></section>
      <section className="px-4 pb-20 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-3">{MARKETING_FEATURES.map((feature) => <article key={feature.title} className="rounded-3xl border border-orange-100 bg-white p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><MarketingIcon name={feature.icon as MarketingIconName} /></div><h2 className="mt-5 text-xl font-black text-stone-950">{feature.title}</h2><p className="mt-3 text-sm leading-6 text-stone-600">{feature.description}</p></article>)}</div></section>
      <MarketingCta />
    </main></MarketingShell>
  )
}
