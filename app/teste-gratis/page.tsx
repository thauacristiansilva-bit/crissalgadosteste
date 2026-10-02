import type { Metadata } from "next"
import { ArrowRight, Check, CreditCard, FileText, Image as ImageIcon, Link2, MapPinned, QrCode, ReceiptText, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { BasicTrialSignup } from "@/components/marketing/basic-trial-signup"
import { getCommercialBillingSession } from "@/lib/billing-commercial-session"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Teste grátis por 7 dias — SaborFlow",
  description: "Comece com produtos, pedidos, PDV e caixa. Gestão simples, sem cartão e com a sua própria conta.",
}

export default async function FreeTrialPage() {
  const session = await getCommercialBillingSession()

  return (
    <MarketingShell>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Sua própria conta · 7 dias grátis
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-950 sm:text-5xl">
              Teste a gestão do SaborFlow com a sua empresa de verdade.
            </h1>
            <p className="mt-5 text-lg leading-8 text-stone-600">
              O cliente cria o próprio acesso, entra com o mesmo e-mail e senha sempre que voltar e já conhece a rotina do sistema com pedidos, produtos, PDV, clientes e operação.
            </p>
            <ul className="mt-7 space-y-3 text-sm font-semibold text-stone-700 sm:text-base">
              {[
                "7 dias grátis, sem cartão e sem cobrança automática",
                "A conta é do próprio cliente, não uma conta demo perdida",
                "A mesma loja continua se a contratação acontecer depois",
                "IA é opcional e pode ser adicionada à parte",
              ].map((text) => (
                <li key={text} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />{text}</li>
              ))}
            </ul>
            <div className="mt-8 rounded-[28px] border border-orange-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">O que a pessoa testa</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Produtos, categorias e complementos",
                  "Pedidos, PDV e cozinha",
                  "Caixa, clientes e operação",
                  "Painel administrativo da própria conta",
                ].map((text) => (
                  <div key={text} className="rounded-2xl bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">✓ {text}</div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-stone-500">Ao final dos 7 dias, o acesso pode continuar com um plano mensal, semestral ou anual. Se a contratação acontecer antes do fim do teste, os dias restantes continuam valendo.</p>
            </div>
          </div>

          <BasicTrialSignup signedIn={Boolean(session)} />
        </section>

        <section className="mt-16 rounded-[32px] border border-emerald-100 bg-white p-7 shadow-sm sm:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Migrar precisa ser simples</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Troque de sistema sem perder dias cadastrando tudo de novo</h2>
            <p className="mt-4 text-base leading-7 text-stone-600">Uma das maiores dores de quem muda de sistema é começar do zero. O SaborFlow pode apresentar esse processo de forma muito mais leve, mostrando que a pessoa pode aproveitar o que já tem.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Link2, title: "Link do sistema antigo", text: "Se o cardápio antigo ainda estiver ativo, o cliente pode informar o link para ajudar na importação." },
              { icon: ImageIcon, title: "Prints e fotos", text: "Também pode anexar prints, cardápio antigo, imagens e referências do que já usava." },
              { icon: FileText, title: "Produtos e valores", text: "A estrutura de categorias, produtos, complementos e preços pode ser reorganizada com mais rapidez." },
              { icon: MapPinned, title: "Entrega e localização", text: "Endereço, área de atendimento, detalhes da operação e entrega podem ser ajustados junto com a migração." },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <Icon className="h-6 w-6 text-emerald-600" />
                <h3 className="mt-4 text-lg font-black text-stone-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-7 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-5 text-sm leading-6 text-stone-600">
            <p className="font-black text-stone-950">Fluxo ideal para apresentar ao cliente</p>
            <p className="mt-2">1. Cria a conta → 2. Testa a gestão por 7 dias → 3. Envia link antigo, prints e informações da operação → 4. Ajusta tudo e publica sem refazer o trabalho do zero.</p>
          </div>
        </section>

        <section className="mt-16 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[32px] border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Depois do teste</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">A contratação precisa continuar simples</h2>
            <p className="mt-4 text-base leading-7 text-stone-600">Quando a pessoa gostar do sistema, o caminho para continuar precisa ser direto: escolher o plano e seguir com a mesma empresa, o mesmo acesso e os mesmos dados.</p>
            <div className="mt-7 space-y-3">
              {[
                "Mensal, semestral ou anual, conforme a estratégia comercial definida.",
                "A pessoa continua usando o mesmo e-mail e a mesma senha.",
                "Os dias restantes do teste grátis não são perdidos se ela contratar antes.",
                "IA pode ser adicionada depois como um recurso extra, sem travar a gestão base.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm font-bold text-stone-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/planos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-950 px-6 py-3.5 text-sm font-black text-white">
                Ver planos e contratação
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-3.5 text-sm font-black text-stone-800">
                Ver demonstração
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">Pagamento simplificado</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">Pix, cartão e boleto</h2>
            <p className="mt-4 text-base leading-7 text-stone-600">Na comunicação comercial, vale mostrar desde já as formas de pagamento mais conhecidas, para reduzir objeção logo na contratação.</p>
            <div className="mt-7 space-y-3">
              {[
                { icon: QrCode, title: "Pix", text: "Prático para pagar e renovar com mais rapidez." },
                { icon: CreditCard, title: "Cartão", text: "Ideal para mensalidades e recorrência organizada." },
                { icon: ReceiptText, title: "Boleto", text: "Alternativa para quem prefere cobrança tradicional." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-orange-600" />
                    <p className="font-black text-stone-950">{title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
