import Link from "next/link"
import { ArrowRight, Check, ChefHat, ClipboardList, Palette, ShoppingBag, Store, Truck } from "lucide-react"
import { MarketingShell, MarketingCta } from "@/components/marketing/marketing-shell"

const features = [
  { icon: ShoppingBag, title: "Seu cardápio online", text: "Organize produtos, sabores e complementos. O cliente escolhe o pedido antes de colocar no carrinho." },
  { icon: ClipboardList, title: "Pedidos em um painel", text: "Acompanhe os pedidos da loja e use o PDV para registrar as vendas no balcão." },
  { icon: ChefHat, title: "Mais clareza na cozinha", text: "Veja produtos, sabores e observações para preparar cada pedido." },
  { icon: Truck, title: "Entrega ou retirada", text: "Organize horários e acompanhe como o cliente quer receber o pedido." },
  { icon: Palette, title: "Uma loja com a sua cara", text: "Escolha um modelo e personalize as cores da página da loja e do cardápio." },
  { icon: Store, title: "Gestão para o dia a dia", text: "Consulte vendas e configure os recursos disponíveis para sua empresa." },
] as const

const steps = [
  { title: "Cadastre sua loja", text: "Informe os dados da empresa, os horários e as formas de entrega." },
  { title: "Monte seu cardápio", text: "Separe os produtos por categoria e escolha os sabores de cada combo." },
  { title: "Compartilhe e acompanhe", text: "Divulgue o link da loja e acompanhe os pedidos pelo painel." },
] as const

export function MarketingHome() {
  return (
    <MarketingShell>
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-bold text-orange-700">Cardápio online, pedidos e gestão</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">Seu pedido organizado.<br /><span className="text-orange-600">Da escolha à entrega.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">Crie o cardápio da sua loja, receba pedidos e acompanhe o preparo em um só painel. Mais fácil para o cliente escolher e para sua equipe atender.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 font-bold text-white hover:bg-orange-700">Testar demonstração <ArrowRight aria-hidden="true" className="h-5 w-5" /></Link>
              <Link href="/planos" className="rounded-2xl border border-stone-300 bg-white px-6 py-4 text-center font-bold text-stone-800 hover:bg-orange-50">Ver planos e preços</Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-500">Explore a demonstração com pedidos fictícios antes de contratar.</p>
          </div>
          <div className="rounded-[28px] border border-orange-100 bg-orange-100/60 p-4 sm:p-6">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
                <span className="font-black text-stone-900">Do cardápio à cozinha</span>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">Exemplo ilustrativo</span>
              </div>
              <div className="space-y-4 p-5 sm:p-7">
                <div className="flex items-start gap-3"><ShoppingBag aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-orange-600" /><div><p className="text-lg font-black">Combo de salgados + bebida</p><p className="mt-1 text-sm text-stone-500">O cliente escolhe os sabores no cardápio.</p></div></div>
                <div className="rounded-xl bg-orange-50 p-4"><p className="font-bold text-stone-900">Sabores escolhidos</p><div className="mt-3 flex flex-wrap gap-2">{["Frango", "Queijo", "Carne"].map(flavor => <span key={flavor} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold"><Check aria-hidden="true" className="h-4 w-4 text-orange-600" />{flavor}</span>)}</div><p className="mt-3 text-sm text-stone-600">Bebida: refrigerante de cola</p></div>
                <div className="rounded-xl border border-stone-200 p-4"><p className="flex items-center gap-2 font-bold"><ChefHat aria-hidden="true" className="h-5 w-5 text-orange-600" />A equipe recebe os detalhes</p><p className="mt-2 text-sm leading-6 text-stone-600">Produtos, sabores, bebida e observações juntos no pedido.</p></div>
                <div className="flex items-center gap-2 rounded-xl bg-stone-950 p-4 font-bold text-white"><Truck aria-hidden="true" className="h-5 w-5 text-orange-400" />Entrega ou retirada no horário escolhido</div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-y border-orange-100 bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-bold text-orange-700">O que você pode organizar</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Menos informação espalhada. Mais clareza.</h2>
            <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-stone-200 p-6"><Icon aria-hidden="true" className="h-7 w-7 text-orange-600" /><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-stone-600">{text}</p></article>)}</div>
            <p className="mt-6 text-sm text-stone-500">A disponibilidade de cada recurso depende do plano e da configuração da loja.</p>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-orange-700">Como começar</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Três passos para montar sua operação.</h2>
          <ol className="mt-9 grid gap-6 md:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="rounded-2xl bg-white p-6"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-lg font-black text-orange-700">{index + 1}</span><h3 className="mt-4 text-xl font-bold">{step.title}</h3><p className="mt-3 text-sm leading-7 text-stone-600">{step.text}</p></li>)}</ol>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8"><div><h2 className="text-xl font-black">Quer ajuda para montar a loja?</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">O assistente IA pode ajudar a organizar o cardápio e as configurações. Você confere a prévia antes de aplicar. A ativação é feita separadamente para cada conta.</p></div><Link href="/recursos" className="mt-5 inline-flex shrink-0 items-center gap-2 font-bold text-orange-700 sm:mt-0">Conhecer os recursos <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div>
        </section>
        <MarketingCta />
      </main>
    </MarketingShell>
  )
}
