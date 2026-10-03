"use client"

import { useMemo, useState } from "react"
import { BookOpenCheck, CircleHelp, Search, Sparkles } from "lucide-react"
import { startSystemTutorial, tutorialCatalog } from "@/components/admin/tutorial-system"

export function HelpCenterPanel() {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return tutorialCatalog
    return tutorialCatalog.filter((tutorial) => {
      const haystack = [
        tutorial.title,
        tutorial.summary,
        ...tutorial.steps.flatMap((step) => [step.title, step.description, step.why]),
      ].join(" ").toLocaleLowerCase("pt-BR")
      return haystack.includes(normalized)
    })
  }, [query])

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-orange-700">
                <CircleHelp className="h-4 w-4" />
                Central de Tutoriais
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">Aprenda mexendo no próprio SaborFlow</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                Em vez de assistir a um vídeo separado, escolha o que quer aprender. O SaborFlow abre a tela real, destaca cada área e explica passo a passo sem apagar nem alterar seus dados.
              </p>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="font-black text-gray-950">{tutorialCatalog.length} tutoriais interativos</p>
              <p className="mt-1 text-xs text-gray-500">Você pode repetir qualquer tutorial quando quiser.</p>
            </div>
          </div>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: cadastrar produto, fazer pedido, configurar entrega..."
              className="h-14 w-full rounded-2xl border border-orange-200 bg-white pl-12 pr-4 text-sm font-semibold text-gray-900 outline-none transition placeholder:font-normal placeholder:text-gray-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h3 className="font-black text-emerald-950">Seus dados continuam exatamente como estão</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-900/75">O tutorial não recria produtos, não limpa formulários salvos e não publica nada sozinho. Você pode apenas ler e avançar. Uma alteração só acontece se você editar a tela real e clicar no botão de salvar daquela área.</p>
          </div>
        </div>
      </section>

      {filtered.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tutorial) => {
            const Icon = tutorial.icon
            return (
              <article key={tutorial.id} className="flex flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-4 text-lg font-black text-gray-950">{tutorial.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{tutorial.summary}</p>
                <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500">{tutorial.steps.length} etapa{tutorial.steps.length === 1 ? "" : "s"} · Pode pular qualquer uma</div>
                <button type="button" onClick={() => startSystemTutorial(tutorial.id)} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white hover:bg-orange-700">
                  <BookOpenCheck className="h-4 w-4" /> Iniciar passo a passo
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-orange-300 bg-orange-50/50 p-8 text-center">
          <CircleHelp className="mx-auto h-8 w-8 text-orange-500" />
          <h3 className="mt-3 font-black text-gray-950">Nenhum tutorial encontrado</h3>
          <p className="mt-1 text-sm text-gray-600">Tente pesquisar por outra função do sistema.</p>
        </div>
      )}
    </div>
  )
}
