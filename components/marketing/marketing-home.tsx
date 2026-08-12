import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, Play, ShieldCheck, Sparkles } from "lucide-react"
import { MARKETING_FEATURES, MARKETING_SEGMENTS } from "@/lib/marketing-content"
import { MarketingCta, MarketingShell } from "@/components/marketing/marketing-shell"
import { MarketingIcon, type MarketingIconName } from "@/components/marketing/marketing-icons"

export function MarketingHome() {
  return (
    <MarketingShell>
      <main>
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-orange-700"><Sparkles className="h-3.5 w-3.5" />Operação de alimentação em um só fluxo</div>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[#2f1c14] sm:text-5xl lg:text-7xl">Pedido entrou. O <span className="text-orange-600">SaborFlow</span> organiza o resto.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">Cardápio online, PDV, cozinha, entrega, clientes, complementos, estoque e gestão conectados para negócios de alimentação que precisam operar com clareza.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-black text-white shadow-sm shadow-orange-200 hover:bg-orange-700"><Play className="h-4 w-4 fill-current" />Testar demonstração</Link>
                <Link href="/planos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3.5 text-sm font-black text-stone-800 hover:border-orange-200">Conhecer planos <ArrowRight className="h-4 w-4" /></Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-stone-500">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />Ambiente multiempresa</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" />Demo isolada</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" />Planos com limites reais</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-orange-200/60 to-amber-50 blur-2xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-orange-100 bg-white p-5 shadow-xl shadow-orange-100/50 sm:p-7">
                <div className="flex items-center justify-between border-b border-stone-100 pb-5">
                  <Image src="/brand/saborflow-mark.webp" alt="Marca SaborFlow" width={104} height={104} className="h-20 w-20 rounded-2xl object-cover object-top" />
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Operação conectada</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Pedidos", "18", "orders"],
                    ["Em produção", "6", "kitchen"],
                    ["Em entrega", "4", "delivery"],
                    ["Estoque", "OK", "inventory"],
                    ["Caixa", "Aberto", "financial"],
                    ["Lojas", "Multi", "multi"],
                  ].map(([label, value, icon]) => (
                    <div key={label} className="rounded-2xl bg-[#fffaf3] p-4">
                      <MarketingIcon name={icon as MarketingIconName} className="h-5 w-5 text-orange-600" />
                      <p className="mt-5 text-xl font-black text-stone-950">{value}</p>
                      <p className="mt-1 text-xs font-bold text-stone-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-stone-950 p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-400">Do pedido ao resultado</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-300"><span>Venda</span><ArrowRight className="h-3.5 w-3.5" /><span>Produção</span><ArrowRight className="h-3.5 w-3.5" /><span>Entrega</span><ArrowRight className="h-3.5 w-3.5" /><span>Gestão</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-orange-100 bg-white px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs font-black uppercase tracking-[0.12em] text-stone-400">
            {MARKETING_SEGMENTS.slice(0, 8).map((segment) => <span key={segment}>{segment}</span>)}
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Recursos conectados</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Menos ilhas. Mais fluxo operacional.</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">Cada módulo foi pensado para compartilhar o mesmo contexto da loja, do cliente e do pedido.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MARKETING_FEATURES.map((feature) => (
                <article key={feature.title} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><MarketingIcon name={feature.icon as MarketingIconName} /></div>
                  <h3 className="mt-5 text-lg font-black text-stone-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{feature.description}</p>
                </article>
              ))}
            </div>
            <div className="mt-8"><Link href="/recursos" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">Ver todos os recursos <ArrowRight className="h-4 w-4" /></Link></div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Experiência real</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Teste a operação sem tocar em dados reais.</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">A demonstração cria um tenant temporário com produtos, pedidos, clientes, caixa, entregadores, complementos e estoque fictícios.</p>
              <Link href="/demo" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-black text-white">Abrir demonstração <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Ambiente isolado por sessão", "Expiração controlada no servidor", "Sem webhooks externos", "Sem impressão externa", "Sem domínio próprio", "Fluxo operacional simulável"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-[#fffaf3] p-4 text-sm font-bold text-stone-700"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{item}</div>
              ))}
            </div>
          </div>
        </section>

        <MarketingCta />
      </main>
    </MarketingShell>
  )
}
