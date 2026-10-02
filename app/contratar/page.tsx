import type { Metadata } from "next"
import { Check, FileUp, ShieldCheck, Sparkles } from "lucide-react"
import { CommercialCheckout } from "@/components/billing/commercial-checkout"
import { MarketingShell } from "@/components/marketing/marketing-shell"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Contratar — SaborFlow",
  description: "Crie sua conta, escolha seu plano e continue com a mesma empresa no SaborFlow.",
}

export default function ContractPage() {
  return (
    <MarketingShell>
      <main className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <aside className="lg:sticky lg:top-24">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black text-orange-800 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                Contratação simples e segura
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-950 sm:text-5xl">Escolha o plano e continue sem começar do zero.</h1>
              <p className="mt-5 text-base leading-7 text-stone-600">Se você já começou o teste grátis, a contratação continua na mesma conta. Produtos, pedidos e configurações permanecem com você.</p>

              <div className="mt-8 space-y-3">
                {[
                  ["1", "Entre ou crie sua conta", "Use o mesmo e-mail e senha do teste grátis."],
                  ["2", "Escolha período e pagamento", "Mensal, semestral ou anual, com Pix, cartão ou boleto."],
                  ["3", "Leia e aceite o contrato", "Veja preço, permanência e cancelamento antes de ir ao pagamento."],
                  ["4", "Traga seu cadastro antigo", "Depois, envie link, prints e fotos para acelerar a migração."],
                ].map(([number, title, text]) => (
                  <div key={number} className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-sm font-black text-white">{number}</span>
                    <div><p className="text-sm font-black text-stone-950">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
                <div className="flex items-center gap-2 text-violet-800"><Sparkles className="h-5 w-5" /><p className="font-black">IA continua opcional</p></div>
                <p className="mt-2 text-sm leading-6 text-stone-600">A gestão base funciona sem IA. O recurso inteligente pode ser contratado separadamente para acelerar importação, configuração e ajustes.</p>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                <div className="flex items-center gap-2 text-emerald-800"><FileUp className="h-5 w-5" /><p className="font-black">Migração assistida</p></div>
                <p className="mt-2 text-sm leading-6 text-stone-600">Após entrar na empresa, você terá uma área para colar o link antigo, enviar até 60 imagens e registrar as regras que precisam ser preservadas.</p>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-black text-amber-950">Semestral e anual têm permanência mínima</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">A regra de rescisão antecipada e a multa de 30% sobre o saldo vincendo aparecem em destaque e exigem confirmação específica antes do pagamento.</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-stone-500">
                {["Mesma conta", "Mesma empresa", "Sem recadastro desnecessário"].map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2"><Check className="h-3.5 w-3.5 text-orange-600" />{item}</span>)}
              </div>
            </aside>

            <div><CommercialCheckout /></div>
          </section>
        </div>
      </main>
    </MarketingShell>
  )
}
