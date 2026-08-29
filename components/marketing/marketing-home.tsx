import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChefHat,
  CreditCard,
  Globe2,
  Monitor,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react"

const modules = [
  {
    icon: ShoppingBag,
    title: "Pedidos online",
    text: "Receba pedidos pelo cardápio digital e acompanhe tudo em um único fluxo.",
  },
  {
    icon: Monitor,
    title: "PDV integrado",
    text: "Venda no balcão com produtos, clientes e pagamentos conectados.",
  },
  {
    icon: ChefHat,
    title: "Cozinha organizada",
    text: "Acompanhe o preparo com mais clareza e menos ruído na operação.",
  },
  {
    icon: Truck,
    title: "Delivery",
    text: "Organize entregas, zonas, entregadores e o andamento dos pedidos.",
  },
  {
    icon: Boxes,
    title: "Estoque",
    text: "Controle produtos, ingredientes, movimentações e disponibilidade.",
  },
  {
    icon: Users,
    title: "Clientes e CRM",
    text: "Centralize histórico, relacionamento e informações dos seus clientes.",
  },
  {
    icon: BarChart3,
    title: "Gestão e relatórios",
    text: "Acompanhe indicadores e informações importantes para decidir melhor.",
  },
  {
    icon: CreditCard,
    title: "Financeiro",
    text: "Tenha visão financeira da operação e acompanhe o desempenho do negócio.",
  },
]

const steps = [
  {
    number: "01",
    title: "Configure sua empresa",
    text: "Cadastre produtos, horários, equipe e formas de atendimento.",
  },
  {
    number: "02",
    title: "Centralize os pedidos",
    text: "Balcão, cardápio digital e operação passam a trabalhar no mesmo sistema.",
  },
  {
    number: "03",
    title: "Acompanhe a operação",
    text: "Veja pedido, produção, entrega, estoque e gestão sem perder contexto.",
  },
  {
    number: "04",
    title: "Cresça com organização",
    text: "Use CRM e relatórios para entender melhor o negócio e tomar decisões.",
  },
]

const segments = [
  "Restaurantes",
  "Lanchonetes",
  "Pizzarias",
  "Salgaderias",
  "Hamburguerias",
  "Cafeterias",
  "Docerias",
  "Dark kitchens",
]

const benefits = [
  "Uma plataforma para toda a operação",
  "Acesso seguro por usuário",
  "Cardápio digital e pedidos online",
  "Suporte a múltiplas empresas",
  "Domínio personalizado para sua marca",
  "Estrutura preparada para crescer com o negócio",
]

export function MarketingHome() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf4] text-stone-950">
      <style>{`
        @keyframes sfLogo3d {
          0%, 100% {
            transform: perspective(1000px) rotateY(-12deg) rotateX(5deg) translateY(0);
          }
          50% {
            transform: perspective(1000px) rotateY(12deg) rotateX(-3deg) translateY(-16px);
          }
        }

        @keyframes sfGlow {
          0%, 100% { opacity: .45; transform: scale(1); }
          50% { opacity: .8; transform: scale(1.08); }
        }

        .sf-logo-3d {
          animation: sfLogo3d 7s ease-in-out infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }

        .sf-glow {
          animation: sfGlow 5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .sf-logo-3d,
          .sf-glow {
            animation: none;
          }
        }
      `}</style>

      <header className="relative z-40 border-b border-orange-100 bg-[#fffaf4]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
              <Image
                src="/saborflow-brand.png"
                alt="SaborFlow"
                width={48}
                height={48}
                className="h-full w-full object-contain"
                priority
              />
            </div>

            <div>
              <p className="text-xl font-black tracking-[-0.04em] text-[#3c2415]">
                SaborFlow
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                Gestão para alimentação
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-stone-600 lg:flex">
            <a href="#recursos" className="transition hover:text-orange-600">
              Recursos
            </a>
            <a href="#como-funciona" className="transition hover:text-orange-600">
              Como funciona
            </a>
            <a href="#segmentos" className="transition hover:text-orange-600">
              Segmentos
            </a>
            <Link href="/planos" className="transition hover:text-orange-600">
              Planos
            </Link>
            <Link href="/faq" className="transition hover:text-orange-600">
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-black text-[#3c2415] transition hover:bg-orange-50"
            >
              Entrar
            </Link>

            <Link
              href="/planos"
              className="hidden items-center gap-2 rounded-xl bg-[#3c2415] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 sm:inline-flex"
            >
              Conhecer planos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="sf-glow absolute -left-32 top-14 h-80 w-80 rounded-full bg-orange-300/30 blur-3xl" />
          <div className="sf-glow absolute -right-24 top-24 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[1.06fr_.94fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-orange-700 shadow-sm">
              <Zap className="h-4 w-4" />
              Sua operação em um único fluxo
            </div>

            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#2f1c13] sm:text-6xl lg:text-7xl">
              Menos confusão.
              <span className="block text-orange-600">
                Mais controle para vender e crescer.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              O SaborFlow conecta pedidos, PDV, cozinha, delivery, estoque,
              clientes, financeiro e gestão para negócios de alimentação que
              querem trabalhar com mais organização.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/planos"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 px-6 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Conhecer o SaborFlow
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/demo"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-6 text-sm font-black text-[#3c2415] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300"
              >
                Ver demonstração
                <Store className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {[
                "Sem instalação",
                "Acesso pelo navegador",
                "Pronto para múltiplas lojas",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-sm font-bold text-stone-600"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute inset-x-8 bottom-4 h-24 rounded-full bg-orange-500/20 blur-3xl" />

            <div className="relative rounded-[40px] border border-orange-200 bg-white/75 p-5 shadow-[0_35px_90px_rgba(86,48,21,.17)] backdrop-blur-xl sm:p-8">
              <div className="absolute right-5 top-5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Plataforma online
              </div>

              <div className="flex min-h-[420px] items-center justify-center">
                <div className="sf-logo-3d relative">
                  <div className="absolute inset-8 rounded-full bg-orange-400/25 blur-3xl" />
                  <div className="relative flex h-72 w-72 items-center justify-center rounded-[64px] border border-orange-100 bg-white p-5 shadow-2xl sm:h-80 sm:w-80">
                    <Image
                      src="/saborflow-brand.png"
                      alt="Logo oficial SaborFlow"
                      width={360}
                      height={360}
                      className="h-full w-full object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Pedidos", value: "Online" },
                  { label: "Operação", value: "Integrada" },
                  { label: "Gestão", value: "Centralizada" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-orange-100 bg-[#fffaf4] p-3 text-center"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-black text-[#3c2415]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
            Tudo conectado
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] text-[#2f1c13] sm:text-5xl">
            Um sistema para acompanhar o negócio do pedido à gestão.
          </h2>
          <p className="mt-5 text-base leading-7 text-stone-600">
            Evite espalhar a operação em várias ferramentas. O SaborFlow reúne
            os principais pontos do dia a dia em uma estrutura única.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="group rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 transition group-hover:bg-orange-600 group-hover:text-white">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-black tracking-[-0.025em] text-[#3c2415]">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="bg-[#2f1c13] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">
                Como funciona
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                Da configuração à rotina da operação.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-orange-50/75">
                O SaborFlow foi pensado para acompanhar o negócio sem
                transformar a tecnologia em mais uma complicação.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="rounded-[28px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm"
                >
                  <p className="text-3xl font-black text-orange-400">
                    {step.number}
                  </p>
                  <h3 className="mt-4 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-orange-50/70">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="segmentos" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
              Feito para alimentação
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] text-[#2f1c13] sm:text-5xl">
              Adapte o SaborFlow ao jeito que sua operação trabalha.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600">
              Atenda no balcão, receba pedidos online, organize produção e
              entrega e acompanhe a gestão da empresa no mesmo ambiente.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {segments.map((segment) => (
                <div
                  key={segment}
                  className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-black text-[#3c2415]"
                >
                  <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                  {segment}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[36px] border border-orange-100 bg-white p-7 shadow-xl shadow-orange-100/40 sm:p-9">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white">
              <ShieldCheck className="h-7 w-7" />
            </div>

            <h3 className="mt-6 text-3xl font-black tracking-[-0.035em] text-[#3c2415]">
              Estrutura para crescer sem perder o controle.
            </h3>

            <div className="mt-7 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm font-bold leading-6 text-stone-600">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-orange-100 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-[1fr_.8fr] lg:px-8">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Globe2 className="h-7 w-7" />
            </div>

            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-orange-600">
              Sua marca, seu endereço
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] text-[#2f1c13] sm:text-5xl">
              Use o domínio da sua empresa no SaborFlow.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
              Além do endereço padrão da plataforma, empresas podem conectar um
              domínio próprio para oferecer uma experiência mais profissional
              aos seus clientes.
            </p>
          </div>

          <div className="rounded-[32px] bg-[#fff7ed] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-stone-400">
              Exemplo
            </p>
            <div className="mt-4 rounded-2xl border border-orange-200 bg-white p-4 font-mono text-sm font-bold text-[#3c2415] shadow-sm">
              pedidos.suaempresa.com.br
            </div>
            <div className="mt-5 flex items-center gap-3 text-sm font-bold text-stone-600">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Domínio conectado à estrutura segura da plataforma.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-orange-600 via-orange-600 to-amber-500 px-6 py-12 text-white shadow-2xl shadow-orange-200 sm:px-10 lg:px-14 lg:py-16">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[45px] border-white/10" />

          <div className="relative grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-100">
                Pronto para conhecer?
              </p>
              <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                Transforme a rotina da sua operação em um fluxo mais simples.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-orange-50">
                Conheça os planos do SaborFlow e escolha a estrutura mais
                adequada para o seu negócio.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/planos"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-orange-700 shadow-lg transition hover:-translate-y-0.5"
              >
                Ver planos
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/entrar"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-6 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Já sou cliente
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-orange-100 bg-[#fff7ed]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/saborflow-brand.png"
                alt="SaborFlow"
                width={48}
                height={48}
                className="rounded-xl bg-white object-contain"
              />
              <div>
                <p className="text-xl font-black text-[#3c2415]">
                  SaborFlow
                </p>
                <p className="text-xs font-bold text-stone-500">
                  Gestão para negócios de alimentação.
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-6 text-stone-500">
              Tecnologia para conectar atendimento, operação e gestão em uma
              experiência mais organizada.
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-stone-400">
              Plataforma
            </p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-stone-600">
              <Link href="/recursos" className="hover:text-orange-600">Recursos</Link>
              <Link href="/segmentos" className="hover:text-orange-600">Segmentos</Link>
              <Link href="/planos" className="hover:text-orange-600">Planos</Link>
              <Link href="/demo" className="hover:text-orange-600">Demonstração</Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-stone-400">
              Ajuda e acesso
            </p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-stone-600">
              <Link href="/login" className="hover:text-orange-600">Entrar</Link>
              <Link href="/faq" className="hover:text-orange-600">Perguntas frequentes</Link>
              <Link href="/termos" className="hover:text-orange-600">Termos de Uso</Link>
              <Link href="/privacidade" className="hover:text-orange-600">Privacidade</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-orange-100">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-stone-400 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>© 2026 SaborFlow. Todos os direitos reservados.</p>
            <p>appsaborflow.com.br</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
