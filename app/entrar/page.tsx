import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Building2, PlayCircle } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"

export const metadata: Metadata = { title: "Entrar — SaborFlow", description: "Acesse o painel SaborFlow ou inicie uma demonstração." }

export default function EnterPage() {
  return (
    <MarketingShell><main className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="mx-auto max-w-5xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Acesso</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-5xl">Onde você quer entrar?</h1><p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">Clientes e equipes acessam o painel operacional. Quem ainda está conhecendo pode abrir a demonstração isolada.</p><div className="mt-10 grid gap-5 md:grid-cols-2"><article className="rounded-[28px] border border-orange-100 bg-white p-7"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Building2 className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-black text-stone-950">Painel SaborFlow</h2><p className="mt-3 text-sm leading-6 text-stone-600">Entre com sua conta para acessar as organizações e recursos permitidos.</p><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-black text-white">Entrar no painel <ArrowRight className="h-4 w-4" /></Link></article><article className="rounded-[28px] border border-orange-200 bg-orange-50/60 p-7"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600"><PlayCircle className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-black text-stone-950">Ainda não é cliente?</h2><p className="mt-3 text-sm leading-6 text-stone-600">Abra uma demo temporária ou avance para a contratação quando quiser.</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/demo" className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white">Testar demo</Link><Link href="/contratar" className="rounded-xl border border-orange-200 bg-white px-5 py-3 text-sm font-black text-stone-800">Contratar</Link></div></article></div></div></main></MarketingShell>
  )
}
