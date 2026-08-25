import type { Metadata } from "next"
import Link from "next/link"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { LEGAL_LAST_UPDATED, TERMS_VERSION } from "@/lib/legal-documents"

export const metadata: Metadata = {
  title: "Termos de Uso — SaborFlow",
  description: "Termos de Uso da plataforma SaborFlow.",
}

const sections = [
  {
    title: "1. Objeto e aceitação",
    body: [
      "Estes Termos disciplinam o acesso e o uso do SaborFlow, plataforma de software voltada à gestão de negócios de alimentação, incluindo recursos de pedidos, cardápio, operação, atendimento, integrações e gestão administrativa.",
      "Ao criar uma conta, contratar um plano ou continuar utilizando a plataforma após a apresentação de uma nova versão aplicável destes Termos, o usuário declara que leu e concorda com as condições aqui descritas.",
    ],
  },
  {
    title: "2. Conta, responsáveis e segurança",
    body: [
      "O responsável pela conta deve fornecer informações verdadeiras, atuais e suficientes para identificação, contratação, segurança e faturamento. A conta administrativa é pessoal e não deve ser compartilhada entre pessoas quando houver recurso próprio de equipe e permissões.",
      "O usuário deve proteger suas credenciais, dispositivos e meios de autenticação e comunicar ao suporte qualquer suspeita de acesso indevido. O SaborFlow poderá exigir verificações adicionais de identidade ou segurança quando houver risco de fraude, abuso ou comprometimento de conta.",
    ],
  },
  {
    title: "3. Responsabilidades da empresa usuária",
    body: [
      "A empresa usuária é responsável pelas informações que publica e opera no sistema, incluindo produtos, preços, disponibilidade, ingredientes, informações de alergênicos quando aplicáveis, horários, taxas, condições de entrega, promoções, tributos e atendimento ao consumidor.",
      "Também é responsabilidade da empresa usuária cumprir as normas aplicáveis à sua atividade, inclusive obrigações consumeristas, fiscais, sanitárias, trabalhistas e de proteção de dados relacionadas à operação do seu negócio.",
    ],
  },
  {
    title: "4. Planos, cobrança e cancelamento",
    body: [
      "Recursos, limites, preços, periodicidade e condições comerciais podem variar conforme o plano apresentado no momento da contratação. Quando houver cobrança recorrente por provedor de pagamento, a ativação e a continuidade do plano dependem da confirmação do status pelo provedor e pelas regras comerciais exibidas na contratação.",
      "Cancelamentos, alterações de plano, reembolsos e efeitos sobre o acesso seguirão as condições apresentadas no fluxo comercial e a legislação aplicável. Obrigações já vencidas ou serviços já prestados podem permanecer devidos conforme o caso.",
    ],
  },
  {
    title: "5. Integrações e serviços de terceiros",
    body: [
      "O SaborFlow pode se integrar a serviços de terceiros, como meios de pagamento, mapas, autenticação, mensageria, hospedagem e outras APIs. Esses serviços possuem disponibilidade, políticas e termos próprios, e podem sofrer mudanças independentes do SaborFlow.",
      "A ativação de uma integração pode exigir que a empresa usuária forneça credenciais, autorizações ou configurações diretamente relacionadas ao serviço escolhido.",
    ],
  },
  {
    title: "6. Recursos automatizados e inteligência artificial",
    body: [
      "Quando recursos automatizados ou de inteligência artificial forem disponibilizados, eles terão finalidade assistiva e poderão interpretar mensagens, resumir informações, sugerir ações ou preparar rascunhos. Ações relevantes, como pedidos, alterações administrativas ou operações financeiras, poderão exigir confirmação humana conforme o fluxo definido na plataforma.",
      "A empresa usuária deve revisar informações críticas antes de confirmá-las e não deve utilizar automações para finalidades ilícitas, discriminatórias, enganosas ou incompatíveis com os direitos de terceiros.",
    ],
  },
  {
    title: "7. Uso aceitável",
    body: [
      "É proibido utilizar o SaborFlow para fraude, invasão, distribuição de malware, tentativa de contornar controles de acesso, exploração de vulnerabilidades, envio ilícito de mensagens, violação de direitos de terceiros ou qualquer atividade proibida por lei.",
      "O SaborFlow poderá limitar ou suspender acessos quando houver risco relevante à segurança, violação destes Termos, abuso técnico, inadimplência aplicável ou determinação legal, observando a proporcionalidade e as regras aplicáveis ao caso.",
    ],
  },
  {
    title: "8. Disponibilidade, manutenção e continuidade",
    body: [
      "A plataforma é operada com medidas de disponibilidade, segurança e recuperação compatíveis com sua natureza, mas serviços digitais podem sofrer indisponibilidades decorrentes de manutenção, falhas de terceiros, incidentes, eventos de força maior ou mudanças técnicas.",
      "Sempre que razoavelmente possível, manutenções relevantes serão planejadas para reduzir impacto operacional. A empresa usuária deve manter rotinas próprias compatíveis com a criticidade de sua operação e não depender do sistema como único meio de preservar informações que a legislação exija manter por outros meios.",
    ],
  },
  {
    title: "9. Propriedade intelectual",
    body: [
      "A tecnologia, marca, interface, documentação e componentes próprios do SaborFlow permanecem protegidos pela legislação aplicável. A contratação concede apenas o direito de uso da plataforma nos limites do plano e destes Termos.",
      "Os dados, marcas, imagens e conteúdos enviados pela empresa usuária continuam pertencendo aos respectivos titulares. A empresa declara possuir autorização para utilizar e disponibilizar tais conteúdos na plataforma.",
    ],
  },
  {
    title: "10. Dados pessoais e privacidade",
    body: [
      "O tratamento de dados pessoais relacionado ao SaborFlow é descrito no Aviso de Privacidade. Dependendo do fluxo, o SaborFlow pode atuar como controlador de dados necessários à conta, segurança, contratação e operação da própria plataforma, e como operador quando processa dados de consumidores em nome da empresa usuária.",
    ],
  },
  {
    title: "11. Alterações destes Termos",
    body: [
      "Estes Termos podem ser atualizados para refletir mudanças legais, técnicas, comerciais ou de segurança. Quando uma alteração exigir nova manifestação do usuário, a plataforma poderá solicitar novo aceite e registrar a versão correspondente.",
    ],
  },
  {
    title: "12. Legislação e contato",
    body: [
      "Estes Termos são regidos pela legislação brasileira. Eventuais controvérsias serão tratadas no foro competente conforme a legislação aplicável, sem afastar direitos inderrogáveis previstos em lei.",
      "Dúvidas sobre estes Termos podem ser encaminhadas pelos canais oficiais de suporte disponibilizados no SaborFlow.",
    ],
  },
]

export default function TermsPage() {
  return (
    <MarketingShell>
      <main className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <article className="mx-auto max-w-4xl rounded-[32px] border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Documentos legais</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-stone-950">Termos de Uso</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-400">
            <span>Versão {TERMS_VERSION}</span>
            <span>Atualizado em {LEGAL_LAST_UPDATED}</span>
          </div>
          <p className="mt-6 text-sm leading-7 text-stone-600">
            Este documento estabelece as regras gerais de uso do SaborFlow. O Aviso de Privacidade complementa estas condições no que se refere ao tratamento de dados pessoais.
          </p>

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

          <div className="mt-10 rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-stone-700">
            Para informações sobre dados pessoais, consulte o <Link href="/privacidade" className="font-black text-orange-700 underline">Aviso de Privacidade</Link>.
          </div>
        </article>
      </main>
    </MarketingShell>
  )
}
