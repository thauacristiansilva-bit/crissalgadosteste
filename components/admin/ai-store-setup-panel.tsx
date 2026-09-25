"use client"

import { useState } from "react"
import { Mic, WandSparkles } from "lucide-react"
import type { SetupPlan } from "@/lib/ai/store-setup"

type VoiceResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type VoiceRecognition = { lang: string; onresult: ((event: VoiceResult) => void) | null; onerror: (() => void) | null; start: () => void }

export function AiStoreSetupPanel({ onApplied }: { onApplied: () => void }) {
  const [prompt, setPrompt] = useState("")
  const [plan, setPlan] = useState<SetupPlan | null>(null)
  const [previewToken, setPreviewToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  function listen() {
    const voiceWindow = window as typeof window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition }
    const Voice = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition
    if (!Voice) { setMessage("O reconhecimento de voz não está disponível neste navegador. Você pode digitar normalmente."); return }
    const recognition = new Voice()
    recognition.lang = "pt-BR"
    recognition.onresult = (event) => { const spoken = Array.from(event.results).map((r) => r[0]?.transcript || "").join(" "); setPrompt((current) => `${current} ${spoken}`.trim()) }
    recognition.onerror = () => setMessage("Não consegui ouvir. Confira a permissão do microfone ou digite o pedido.")
    try { recognition.start(); setMessage("Ouvindo... fale sobre sua loja e seus produtos.") } catch { setMessage("Não foi possível ligar o microfone.") }
  }

  async function send(action: "preview" | "apply") {
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/ai/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "preview" ? { action, prompt } : { action, plan, previewToken }) })
      const rawResponse = await response.text()
      let data: { error?: string; plan?: SetupPlan; previewToken?: string; createdProducts?: number; reusedProducts?: number }
      try { data = JSON.parse(rawResponse) } catch {
        throw new Error(`O servidor não respondeu corretamente (HTTP ${response.status}). Aguarde alguns segundos e tente novamente.`)
      }
      if (!response.ok) throw new Error(data.error || "Não foi possível completar o pedido.")
      if (action === "preview") { if (!data.plan || !data.previewToken) throw new Error("A IA não devolveu uma prévia completa. Tente novamente."); setPlan(data.plan); setPreviewToken(data.previewToken); setMessage("Confira a prévia. Você pode corrigir nomes, preços e regras antes de salvar.") }
      else { setPlan(null); setPreviewToken(""); setMessage(`Cadastro salvo: ${data.createdProducts} produto(s) novos; ${data.reusedProducts} já existentes.`); onApplied() }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha inesperada.") }
    finally { setBusy(false) }
  }

  function editStore(field: Exclude<keyof SetupPlan["store"], "clientAccountsEnabled">, value: string) { setPlan((old) => old ? { ...old, store: { ...old.store, [field]: value } } : old) }
  function editGroup(index: number, patch: Partial<SetupPlan["groups"][number]>) { setPlan((old) => old ? { ...old, groups: old.groups.map((g, i) => i === index ? { ...g, ...patch } : g) } : old) }
  function editProduct(index: number, patch: Partial<SetupPlan["products"][number]>) { setPlan((old) => old ? { ...old, products: old.products.map((p, i) => i === index ? { ...p, ...patch } : p) } : old) }
  const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"

  return <div className="mx-auto max-w-5xl space-y-5">
    <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-3"><WandSparkles className="text-orange-600"/><h2 className="text-xl font-black">Montar minha loja com IA</h2></div>
      <p className="mt-2 text-sm text-gray-600">Descreva a página inicial, categorias, produtos, sabores, quantidades obrigatórias e sugestões para o pedido. Se já houver itens, eles serão reaproveitados por nome.</p>
      <p className="mt-2 text-xs text-gray-500">Exemplo: Minha loja é Cris Salgados. Crie um combo com 4 salgados, escolha obrigatória de no mínimo 4 sabores e máximo de 4 por unidade. Sabores: frango, carne, pizza. Se comprar 2 combos, poderá escolher até 8. Sugira refrigerante junto do combo.</p>
      <textarea className={`${input} mt-4 min-h-32`} value={prompt} maxLength={10000} onChange={(event) => setPrompt(event.target.value)} placeholder="Escreva ou dite aqui o que quer cadastrar..." aria-label="Descrição da loja para a IA" />
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={listen} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Mic className="h-4 w-4"/> Falar</button><button type="button" disabled={busy || prompt.trim().length < 12} onClick={() => send("preview")} className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? "Preparando..." : "Gerar prévia"}</button></div>
      {message && <p role="status" className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-950">{message}</p>}
    </section>
    {plan && <div className="space-y-5">
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Página inicial da sua loja</h3><p className="mb-4 text-xs text-gray-500">As fotos você adiciona depois nas Configurações.</p><div className="grid gap-3 sm:grid-cols-2">
        {([ ["name","Nome da loja"], ["slogan","Slogan"], ["welcomeTitle","Título principal"], ["welcomeText","Texto principal"], ["aboutTitle","Título Sobre"], ["aboutText","Texto Sobre"], ["primaryColor","Cor principal (#RRGGBB)"], ["secondaryColor","Cor secundária (#RRGGBB)"], ["phone","Telefone"], ["whatsapp","WhatsApp"], ["openingHours","Horário em texto"] ] as Array<[Exclude<keyof SetupPlan["store"], "clientAccountsEnabled">,string]>).map(([key,label]) => <label key={key} className="block text-xs font-bold">{label}<input className={`${input} mt-1`} value={plan.store[key]} onChange={(e) => editStore(key,e.target.value)} /></label>)}
        <label className="block text-xs font-bold">Área do cliente<select className={`${input} mt-1`} value={plan.store.clientAccountsEnabled === null ? "keep" : plan.store.clientAccountsEnabled ? "on" : "off"} onChange={(e) => setPlan((old) => old ? { ...old, store: { ...old.store, clientAccountsEnabled: e.target.value === "keep" ? null : e.target.value === "on" } } : old)}><option value="keep">Manter como está</option><option value="on">Ativar cadastro dos clientes</option><option value="off">Desativar cadastro dos clientes</option></select></label>
      </div></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Categorias ({plan.categories.length})</h3><div className="mt-3 flex flex-wrap gap-2">{plan.categories.map((name,index) => <input key={index} aria-label={`Categoria ${index+1}`} className="w-40 rounded-xl border p-2 text-sm" value={name} onChange={(e) => setPlan({ ...plan, categories: plan.categories.map((v,i) => i === index ? e.target.value : v) })}/>)}</div><p className="mt-2 text-xs text-gray-500">Ao alterar o nome de uma categoria, ajuste a categoria dos produtos abaixo.</p></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Sabores e complementos ({plan.groups.length})</h3><div className="mt-3 space-y-4">{plan.groups.map((group,index) => <div key={index} className="rounded-2xl bg-gray-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Título do grupo<input className={`${input} mt-1`} value={group.name} onChange={(e) => editGroup(index,{ name:e.target.value })}/></label><label className="text-xs font-bold">Modo<select className={`${input} mt-1`} value={group.selectionMode} onChange={(e) => editGroup(index,{selectionMode:e.target.value as "bundle" | "unique"})}><option value="unique">Complementos distintos</option><option value="bundle">Combo: sabores repetíveis</option></select></label><label className="text-xs font-bold">Mínimo por unidade<input type="number" min="0" className={`${input} mt-1`} value={group.minSelect} onChange={(e) => editGroup(index,{minSelect:Number(e.target.value)})}/></label><label className="text-xs font-bold">Máximo por unidade<input type="number" min="1" className={`${input} mt-1`} value={group.maxSelect} onChange={(e) => editGroup(index,{maxSelect:Number(e.target.value)})}/></label></div><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={group.required} onChange={(e) => editGroup(index,{required:e.target.checked})}/> Obrigatório</label><div className="mt-3 grid gap-2 sm:grid-cols-2">{group.options.map((option,optIndex) => <div key={optIndex} className="flex gap-2"><input aria-label={`Opção ${optIndex+1}`} className={input} value={option.name} onChange={(e) => editGroup(index,{options:group.options.map((o,i)=> i===optIndex?{...o,name:e.target.value}:o)})}/><input aria-label={`Preço adicional ${option.name}`} title="Preço adicional" type="number" step="0.01" min="0" className="w-20 rounded-xl border px-2 text-sm" value={option.priceDelta} onChange={(e) => editGroup(index,{options:group.options.map((o,i)=>i===optIndex?{...o,priceDelta:Number(e.target.value)}:o)})}/></div>)}</div><button type="button" onClick={() => editGroup(index,{options:[...group.options,{name:"",priceDelta:0}]})} className="mt-2 text-xs font-bold text-orange-700">+ Opção</button></div>)}</div></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Produtos e sugestões ({plan.products.length})</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{plan.products.map((product,index) => <article key={index} className="rounded-2xl border p-4"><label className="text-xs font-bold">Produto<input className={`${input} mt-1`} value={product.name} onChange={(e) => editProduct(index,{name:e.target.value})}/></label><label className="mt-2 block text-xs font-bold">Descrição<input className={`${input} mt-1`} value={product.description} onChange={(e) => editProduct(index,{description:e.target.value})}/></label><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs font-bold">Categoria<select className={`${input} mt-1`} value={product.category} onChange={(e) => editProduct(index,{category:e.target.value})}>{plan.categories.map((c,i)=><option key={i} value={c}>{c}</option>)}</select></label><label className="text-xs font-bold">Preço em R$<input type="number" min="0" step="0.01" className={`${input} mt-1`} value={product.price} onChange={(e) => editProduct(index,{price:Number(e.target.value)})}/></label></div><label className="mt-2 block text-xs font-bold">Grupos (separados por vírgula)<input className={`${input} mt-1`} value={product.groups.join(", ")} onChange={(e)=>editProduct(index,{groups:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></label><label className="mt-2 block text-xs font-bold">Sugestões (nomes separados por vírgula)<input className={`${input} mt-1`} value={product.suggestions.join(", ")} onChange={(e)=>editProduct(index,{suggestions:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></label><label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={product.featured} onChange={(e)=>editProduct(index,{featured:e.target.checked})}/> Destaque na página inicial</label></article>)}</div></section>
      <div className="sticky bottom-4 rounded-2xl border bg-white p-4 shadow-xl"><p className="mb-2 text-xs text-gray-600">Revise os preços e os nomes. Produtos sem preço ficam ocultos até você informar o valor em Produtos. Produtos existentes com mesmo nome e categoria serão reaproveitados.</p><button type="button" disabled={busy} onClick={() => send("apply")} className="w-full rounded-xl bg-green-700 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? "Salvando..." : "Confirmar e cadastrar tudo"}</button></div>
    </div>}
  </div>
}
