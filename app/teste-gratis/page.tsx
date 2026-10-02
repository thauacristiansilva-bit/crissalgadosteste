import type { Metadata } from "next"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { BasicTrialSignup } from "@/components/marketing/basic-trial-signup"
import { getCommercialBillingSession } from "@/lib/billing-commercial-session"
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Teste grátis por 7 dias — SaborFlow", description: "Comece com produtos, pedidos, PDV e caixa. Gestão simples, sem IA e sem cartão." }
export default async function FreeTrialPage() {
  const session = await getCommercialBillingSession()
  return <MarketingShell><main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-20"><div><p className="text-sm font-bold text-orange-700">Seu negócio, do seu jeito</p><h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">O essencial para organizar sua loja.</h1><p className="mt-5 text-lg leading-8 text-stone-600">Teste por 7 dias com seus produtos e pedidos. Comece pequeno, conheça o painel e veja como ele funciona na sua rotina.</p><ul className="mt-7 space-y-3 font-semibold text-stone-700">{["Produtos, categorias e complementos", "Pedidos, PDV e cozinha", "Caixa e cadastro de clientes", "1 loja, 1 acesso e até 30 produtos"].map(text => <li key={text}>✓ {text}</li>)}</ul><p className="mt-6 text-sm leading-6 text-stone-500">Sem cartão e sem cobrança automática. O teste básico não inclui IA, emissão fiscal, domínio próprio ou integrações externas. Ao final dos 7 dias, o acesso é pausado.</p><p className="mt-3 text-sm text-stone-500">Já iniciou seu teste? Entre com a mesma conta para continuar de onde parou.</p></div><BasicTrialSignup signedIn={Boolean(session)} /></main></MarketingShell>
}
