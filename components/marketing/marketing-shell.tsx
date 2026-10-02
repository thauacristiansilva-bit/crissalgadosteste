import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, Menu } from "lucide-react"

const navigation = [
  ["Recursos", "/#recursos"],
  ["Como funciona", "/#como-funciona"],
  ["Planos", "/planos"],
  ["Demonstração", "/demo"],
] as const

export function MarketingLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="SaborFlow — página inicial">
      <Image
        src="/brand/saborflow-mark.webp"
        alt="SaborFlow"
        width={compact ? 42 : 52}
        height={compact ? 42 : 52}
        className="rounded-xl object-cover object-top"
        priority
      />
      <div className="leading-none">
        <span className="block text-lg font-black tracking-tight text-[#2f1c14]">Sabor<span className="text-orange-600">Flow</span></span>
        {!compact && <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">Pedidos · operação · gestão</span>}
      </div>
    </Link>
  )
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pt-[76px] bg-[#fffaf3] text-stone-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-orange-100/80 bg-[#fffaf3]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <MarketingLogo compact />
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegação principal">
            {navigation.map(([label, href]) => (
              <Link key={href} href={href} className="text-sm font-bold text-stone-600 transition hover:text-orange-600">{label}</Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/entrar" className="rounded-xl px-4 py-2.5 text-sm font-black text-stone-700 hover:bg-white">Entrar</Link>
            <Link href="/teste-gratis" className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-700">Testar grátis <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <Link href="/teste-gratis" className="rounded-xl bg-orange-600 px-3 py-2.5 text-xs font-black text-white sm:hidden">Testar grátis</Link>
          <details className="relative lg:hidden">
            <summary aria-label="Abrir menu de navegação" className="flex h-11 w-11 list-none items-center justify-center rounded-xl border border-orange-100 bg-white text-stone-800 [&::-webkit-details-marker]:hidden"><Menu aria-hidden="true" className="h-5 w-5" /></summary>
            <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-orange-100 bg-white p-3 shadow-xl">
              {navigation.map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-stone-700 hover:bg-orange-50">{label}</Link>)}
              <div className="my-2 border-t border-stone-100" />
              <Link href="/entrar" className="block rounded-xl px-3 py-2.5 text-sm font-bold text-stone-700 hover:bg-orange-50">Entrar</Link>
              <Link href="/teste-gratis" className="mt-1 block rounded-xl bg-stone-950 px-3 py-2.5 text-center text-sm font-black text-white">Testar grátis</Link>
            </div>
          </details>
        </div>
      </header>

      {children}

      <footer className="border-t border-orange-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
          <div>
            <MarketingLogo />
            <p className="mt-4 max-w-sm text-sm leading-6 text-stone-500">Tecnologia para organizar pedidos, operação e gestão de negócios de alimentação em um único fluxo.</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Conheça</p>
            <div className="mt-4 grid gap-2 text-sm font-bold text-stone-600">
              <Link href="/solucoes">Soluções</Link><Link href="/recursos">Recursos</Link><Link href="/segmentos">Segmentos</Link><Link href="/planos">Planos</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">Comece</p>
            <div className="mt-4 grid gap-2 text-sm font-bold text-stone-600">
              <Link href="/demo">Testar demonstração</Link><Link href="/teste-gratis">Teste grátis</Link><Link href="/entrar">Entrar no painel</Link><Link href="/faq">Perguntas frequentes</Link>
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-stone-400">Legal</p>
            <div className="mt-3 grid gap-2 text-sm font-bold text-stone-600">
              <Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Aviso de Privacidade</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-stone-100 px-4 py-5 text-center text-xs font-semibold text-stone-400">SaborFlow · Plataforma de gestão para alimentação</div>
      </footer>
    </div>
  )
}

export function MarketingCta() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-stone-950 px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-14">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Veja funcionando</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Experimente antes de escolher seu plano.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-300">Veja o cardápio e o painel na demonstração. Depois, compare os planos para sua loja.</p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col xl:flex-row">
          <Link href="/demo" className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-white hover:bg-orange-600">Testar demonstração</Link>
          <Link href="/planos" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/15">Conhecer planos</Link>
        </div>
      </div>
    </section>
  )
}
