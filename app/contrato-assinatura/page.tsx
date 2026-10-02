import type { Metadata } from "next"
import Link from "next/link"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { LEGAL_LAST_UPDATED, SUBSCRIPTION_CONTRACT_VERSION } from "@/lib/legal-documents"
import { EARLY_TERMINATION_PENALTY_PERCENT, SABORFLOW_FIXED_PRICING } from "@/lib/commercial-contract"

export const metadata: Metadata = {
  title: "Contrato de Licença e Assinatura — SaborFlow",
  description: "Condições comerciais, licença de uso, permanência e cancelamento do SaborFlow.",
}

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

const sections = [
  {
    title: "1. Objeto e licença de uso",
    body: [
      "O presente Contrato de Licença e Assinatura disciplina a contratação do SaborFlow, software de gestão disponibilizado como serviço, mediante licença de uso não exclusiva, temporária e limitada à conta e aos recursos contratados.",
      "A contratação não transfere propriedade intelectual, código-fonte, marca ou qualquer direito de titularidade sobre o SaborFlow. A empresa contratante recebe o direito de utilizar a plataforma durante a vigência da assinatura, conforme o plano, estes termos e a legislação aplicável.",
    ],
  },
  {
    title: "2. Teste grátis e início do plano pago",
    body: [
      "Quando disponível, o teste grátis de 7 dias utiliza a própria conta da empresa contratante. Caso o plano pago seja contratado antes do término do teste, os dias gratuitos restantes são preservados e a vigência paga é programada para iniciar após o término do período promocional.",
      "A ativação comercial depende da confirmação do meio de pagamento utilizado. A criação de checkout, boleto, Pix ou tentativa de cartão, isoladamente, não equivale à confirmação financeira.",
    ],
  },
  {
    title: "3. Planos e valores de referência",
    body: [
      `Plano mensal: ${brl(SABORFLOW_FIXED_PRICING.monthly.installmentCents)} por mês, sem permanência mínima além do ciclo já contratado.`,
      `Plano semestral: ${brl(SABORFLOW_FIXED_PRICING.semiannual.installmentCents)} por mês durante 6 meses, valor contratual de ${brl(SABORFLOW_FIXED_PRICING.semiannual.contractTotalCents)}.`,
      `Plano anual: ${brl(SABORFLOW_FIXED_PRICING.annual.installmentCents)} por mês durante 12 meses, valor contratual de ${brl(SABORFLOW_FIXED_PRICING.annual.contractTotalCents)}.`,
      "Os preços efetivamente aplicáveis são os apresentados no resumo da contratação antes do aceite. Alterações futuras não modificam retroativamente um período já contratado.",
    ],
  },
  {
    title: "4. Permanência e rescisão antecipada",
    body: [
      `Os planos semestral e anual possuem permanência mínima correspondente ao período escolhido, concedida em contrapartida ao preço mensal reduzido em relação ao plano mensal. Se a contratante solicitar cancelamento antes do término desse período, poderá ser aplicada multa de ${EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo das mensalidades vincendas até o fim do compromisso contratado.`,
      "Exemplo: em um plano anual de R$ 79,90 por mês, após 5 mensalidades pagas restam 7 mensalidades. O saldo vincendo é R$ 559,30 e a multa contratual de 30% corresponderia a R$ 167,79, antes de eventuais ajustes legalmente exigidos.",
      "A multa será calculada de forma proporcional ao saldo efetivamente restante e aplicada nos limites permitidos pela legislação. Não será exigida quando a legislação afastar sua cobrança, inclusive nas hipóteses de descumprimento contratual imputável ao SaborFlow ou de exercício de direito legal de arrependimento quando aplicável.",
      "O plano mensal poderá ser cancelado para impedir nova renovação, sem multa de fidelidade, permanecendo devidos valores já vencidos ou referentes ao período já contratado.",
    ],
  },
  {
    title: "5. Renovação",
    body: [
      "O plano mensal poderá ter renovação recorrente conforme a forma de pagamento autorizada. Planos com prazo de permanência devem apresentar de forma clara o período contratado e suas condições de renovação no momento da contratação.",
      "Sempre que a legislação ou o fluxo comercial exigir nova autorização para renovação com novo período de permanência, o SaborFlow solicitará manifestação expressa da contratante.",
    ],
  },
  {
    title: "6. Meios de pagamento",
    body: [
      "A contratação poderá disponibilizar Pix, cartão de crédito e boleto, conforme disponibilidade do provedor de pagamentos integrado. A confirmação, compensação, prazo e eventuais recusas dependem das regras do respectivo meio de pagamento.",
      "O SaborFlow não considera o plano pago como quitado apenas pelo redirecionamento do checkout; a ativação definitiva depende de confirmação financeira recebida do provedor ou da conciliação aplicável.",
    ],
  },
  {
    title: "7. Inteligência artificial e adicionais",
    body: [
      "Recursos de inteligência artificial, importação assistida e outros serviços adicionais podem possuir preço, franquia, prazo e limites próprios, independentemente da assinatura principal do SaborFlow.",
      "A contratação do plano base não implica, por si só, franquia ilimitada de processamento de IA, salvo quando expressamente informado na oferta.",
    ],
  },
  {
    title: "8. Inadimplência e suspensão",
    body: [
      "A falta de pagamento poderá gerar avisos, bloqueio de renovação, suspensão temporária ou rescisão, respeitados os prazos, notificações e direitos previstos na legislação e nas condições comerciais aplicáveis.",
      "A suspensão por inadimplência não extingue obrigações já vencidas nem, quando juridicamente aplicável, as consequências da rescisão antecipada de contrato com permanência mínima.",
    ],
  },
  {
    title: "9. Termos de Uso e privacidade",
    body: [
      "Este contrato é complementar aos Termos de Uso e ao Aviso de Privacidade do SaborFlow. Em caso de relação de consumo, direitos inderrogáveis previstos em lei prevalecem sobre disposições contratuais incompatíveis.",
    ],
  },
  {
    title: "10. Legislação aplicável",
    body: [
      "O contrato é regido pela legislação brasileira. Cláusulas de penalidade, permanência, reembolso e cancelamento serão aplicadas de forma proporcional e nos limites legalmente admitidos, sem afastar direitos que não possam ser renunciados.",
    ],
  },
]

export default function SubscriptionContractPage() {
  return (
    <MarketingShell>
      <main className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <article className="mx-auto max-w-4xl rounded-[32px] border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Documento comercial</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-stone-950">Contrato de Licença e Assinatura</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-400">
            <span>Versão {SUBSCRIPTION_CONTRACT_VERSION}</span>
            <span>Atualizado em {LEGAL_LAST_UPDATED}</span>
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
            <strong>Atenção aos planos semestral e anual:</strong> há permanência mínima. O cancelamento antecipado pode gerar multa de 30% sobre o saldo restante do período contratado, observados os limites legais e as hipóteses em que a cobrança não seja permitida.
          </div>
          <div className="mt-10 space-y-9">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-black text-stone-900">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-stone-600">
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Link href="/termos" className="rounded-xl border border-stone-200 px-4 py-3 text-center text-sm font-black text-stone-700">Ler Termos de Uso</Link>
            <Link href="/privacidade" className="rounded-xl border border-stone-200 px-4 py-3 text-center text-sm font-black text-stone-700">Ler Aviso de Privacidade</Link>
          </div>
        </article>
      </main>
    </MarketingShell>
  )
}
