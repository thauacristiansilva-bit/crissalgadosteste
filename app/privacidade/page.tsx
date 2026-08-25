import type { Metadata } from "next"
import Link from "next/link"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { LEGAL_LAST_UPDATED, PRIVACY_VERSION } from "@/lib/legal-documents"

export const metadata: Metadata = {
  title: "Aviso de Privacidade — SaborFlow",
  description: "Como o SaborFlow trata dados pessoais.",
}

const sections = [
  {
    title: "1. Finalidade deste aviso",
    body: [
      "Este Aviso explica, de forma objetiva, como dados pessoais podem ser tratados no uso do SaborFlow, incluindo dados de responsáveis por empresas, membros de equipe, consumidores que realizam pedidos e informações técnicas relacionadas à segurança e ao funcionamento da plataforma.",
      "O tratamento observa a legislação brasileira aplicável, especialmente a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD), de acordo com a finalidade e o papel exercido em cada operação.",
    ],
  },
  {
    title: "2. Papéis no tratamento de dados",
    body: [
      "Para dados necessários à criação da conta SaborFlow, autenticação, segurança, contratação, faturamento, suporte e proteção da própria plataforma, o responsável pela operação do SaborFlow pode atuar como controlador.",
      "Para dados de consumidores tratados pela empresa usuária por meio de pedidos, CRM, entrega, fidelidade, campanhas e atendimento, a empresa usuária normalmente define as finalidades e atua como controladora, enquanto o SaborFlow processa os dados como operador, ressalvadas operações próprias necessárias à segurança, prevenção a fraude e cumprimento de obrigações legais.",
    ],
  },
  {
    title: "3. Dados que podem ser tratados",
    body: [
      "Dados cadastrais e de identificação, como nome, e-mail, telefone, CPF do responsável pela conta, que no fluxo atual de cadastro é armazenado em formato protegido, CNPJ da empresa quando informado e identificadores de autenticação.",
      "Dados de operação comercial, como pedidos, itens, endereços de entrega, preferências, histórico de relacionamento, cupons, fidelidade, informações financeiras operacionais e registros de atendimento.",
      "Dados técnicos e de segurança, como endereço IP, navegador, dispositivo, registros de acesso, eventos de auditoria, tentativas de autenticação e informações necessárias à prevenção de fraude e incidentes.",
      "Dados provenientes de integrações habilitadas pela empresa, como autenticação Google, mapas, meios de pagamento, WhatsApp e outros provedores. Quando recursos de áudio ou inteligência artificial forem ativados, mensagens, transcrições e arquivos de mídia poderão ser processados para executar a finalidade solicitada.",
    ],
  },
  {
    title: "4. Finalidades e bases legais",
    body: [
      "Os dados podem ser usados para criar e administrar contas, executar contratos e procedimentos de contratação, autenticar usuários, processar pedidos, prestar suporte, operar recursos contratados, prevenir fraudes, manter segurança, cumprir obrigações legais e exercer direitos em processos.",
      "A base legal depende da operação concreta e pode incluir execução de contrato ou procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse quando aplicável e, nos casos em que a LGPD realmente exigir, consentimento.",
      "O simples acesso ao Aviso de Privacidade não é tratado como consentimento genérico para todas as finalidades. Consentimentos específicos, como comunicações promocionais quando necessários, devem ser coletados separadamente.",
    ],
  },
  {
    title: "5. Compartilhamento e operadores",
    body: [
      "Dados podem ser compartilhados, no mínimo necessário, com provedores de infraestrutura, hospedagem, banco de dados, autenticação, mapas, pagamento, mensageria, segurança, suporte e demais fornecedores necessários aos recursos efetivamente habilitados.",
      "Quando a empresa usuária ativa integrações de terceiros, os dados necessários àquela integração podem ser enviados ao respectivo provedor de acordo com a configuração escolhida. Autoridades públicas também podem receber informações quando houver obrigação legal, ordem válida ou exercício regular de direitos.",
    ],
  },
  {
    title: "6. Transferências internacionais",
    body: [
      "Alguns fornecedores tecnológicos podem processar dados fora do Brasil. Quando isso ocorrer, serão consideradas as regras aplicáveis da LGPD e mecanismos adequados de proteção e contratação compatíveis com o serviço utilizado.",
    ],
  },
  {
    title: "7. Retenção e eliminação",
    body: [
      "Os dados são mantidos pelo período necessário para cumprir a finalidade que justificou o tratamento, prestar o serviço, atender obrigações legais ou regulatórias, resolver disputas, exercer direitos e preservar registros de segurança e auditoria.",
      "Dados que deixarem de ser necessários poderão ser eliminados, anonimizados ou mantidos apenas quando houver fundamento legal para conservação. Arquivos de áudio e outras mídias de atendimento, quando esse recurso estiver ativo, devem seguir prazos compatíveis com a finalidade e poderão ter retenção reduzida em relação aos registros textuais do pedido.",
    ],
  },
  {
    title: "8. Segurança",
    body: [
      "São adotadas medidas técnicas e administrativas compatíveis com o risco, como controle de acesso, isolamento entre empresas, autenticação, registro de auditoria, proteção de credenciais, validação de requisições, restrição de permissões e monitoramento técnico.",
      "Nenhum ambiente digital é absolutamente imune a incidentes. Caso ocorra evento de segurança envolvendo dados pessoais, serão avaliadas as medidas de contenção, investigação e comunicações exigidas pela legislação aplicável.",
    ],
  },
  {
    title: "9. Direitos dos titulares",
    body: [
      "Nos termos da LGPD, o titular pode ter direitos como confirmação da existência de tratamento, acesso, correção, informação sobre compartilhamento, anonimização, bloqueio ou eliminação quando cabíveis, portabilidade nos termos da regulamentação, oposição e revisão de decisões quando aplicável.",
      "Quando a solicitação envolver dados de consumidor mantidos pela empresa usuária, o pedido poderá precisar ser direcionado à própria empresa, por ela ser a controladora daquele tratamento. O SaborFlow poderá auxiliá-la tecnicamente no atendimento quando atuar como operador.",
    ],
  },
  {
    title: "10. Cookies e armazenamento local",
    body: [
      "A plataforma pode utilizar cookies e armazenamento local necessários para autenticação, segurança, preferências, carrinho, continuidade de sessão e funcionamento dos recursos. Tecnologias analíticas ou de marketing, quando habilitadas, devem observar as configurações e bases legais aplicáveis.",
    ],
  },
  {
    title: "11. Atualizações e contato",
    body: [
      "Este Aviso pode ser atualizado para refletir mudanças legais, técnicas ou de funcionalidades. Quando necessário, uma nova versão poderá ser apresentada para ciência ou aceite conforme a natureza da alteração.",
      "Solicitações relacionadas à privacidade podem ser encaminhadas pelos canais oficiais de suporte disponibilizados na plataforma. A identificação formal do agente responsável e canais adicionais deverão acompanhar os dados comerciais e institucionais disponibilizados pelo operador do SaborFlow.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <main className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <article className="mx-auto max-w-4xl rounded-[32px] border border-orange-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Privacidade e dados pessoais</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-stone-950">Aviso de Privacidade</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-400">
            <span>Versão {PRIVACY_VERSION}</span>
            <span>Atualizado em {LEGAL_LAST_UPDATED}</span>
          </div>
          <p className="mt-6 text-sm leading-7 text-stone-600">
            O objetivo é explicar quais categorias de dados podem ser utilizadas, para quais finalidades e quais proteções e direitos se aplicam no ecossistema SaborFlow.
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
            As regras gerais de uso da plataforma estão nos <Link href="/termos" className="font-black text-orange-700 underline">Termos de Uso</Link>.
          </div>
        </article>
      </main>
    </MarketingShell>
  )
}
