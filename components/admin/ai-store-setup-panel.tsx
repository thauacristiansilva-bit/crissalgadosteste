"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, WandSparkles } from "lucide-react"
import type { SetupPlan } from "@/lib/ai/store-setup"
import type { Product, StoreSettings } from "@/lib/types"

const settingLabels: Record<keyof SetupPlan["store"], string> = {
  name: "Nome da loja", slogan: "Slogan / bio", welcomeTitle: "Título da capa",
  welcomeText: "Texto da capa", aboutTitle: "Título Sobre nós", aboutText: "Texto Sobre nós",
  primaryColor: "Cor principal", secondaryColor: "Cor secundária", phone: "Telefone",
  whatsapp: "WhatsApp", instagramUrl: "Instagram", openingHours: "Horário em texto",
  clientAccountsEnabled: "Área do cliente",
}

type VoiceResult = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
type VoiceRecognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: VoiceResult) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }

export function AiStoreSetupPanel({ publicStorePath, onApplied, availableProducts, currentSettings }: { publicStorePath: string; onApplied?: () => Promise<void>; availableProducts: Product[]; currentSettings: StoreSettings }) {
  const [prompt, setPrompt] = useState("")
  const [plan, setPlan] = useState<SetupPlan | null>(null)
  const [previewToken, setPreviewToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [listening, setListening] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCaptions, setSavedCaptions] = useState<string[]>([])
  const [logoAnalyzed, setLogoAnalyzed] = useState(false)
  const [previewWidth, setPreviewWidth] = useState<"phone" | "desktop">("desktop")
  const previewRef = useRef<HTMLIFrameElement | null>(null)
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const baseTextRef = useRef("")
  const finalTextRef = useRef("")
  const interimTextRef = useRef("")
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    shouldListenRef.current = false
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
    recognitionRef.current?.stop()
  }, [])

  useEffect(() => {
    if (!plan) return
    const postPreview = () => previewRef.current?.contentWindow?.postMessage({ type: "saborflow:ai-landing-preview", settings: currentSettings, products: availableProducts, plan, basePath: publicStorePath }, window.location.origin)
    const ready = (event: MessageEvent<{ type?: string }>) => {
      if (event.origin === window.location.origin && event.source === previewRef.current?.contentWindow && event.data?.type === "saborflow:ai-landing-ready") postPreview()
    }
    window.addEventListener("message", ready)
    postPreview()
    return () => window.removeEventListener("message", ready)
  }, [plan, currentSettings, availableProducts, publicStorePath])

  function startListening() {
    if (shouldListenRef.current) return
    const voiceWindow = window as typeof window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition }
    const Voice = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition
    if (!Voice) { setMessage("O reconhecimento de voz não está disponível neste navegador. Você pode digitar normalmente."); return }
    const recognition = new Voice()
    recognitionRef.current = recognition
    baseTextRef.current = prompt.trim()
    finalTextRef.current = ""
    interimTextRef.current = ""
    shouldListenRef.current = true
    recognition.lang = "pt-BR"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      const results = Array.from(event.results)
      const final = results.filter((result) => result.isFinal).map((result) => result[0]?.transcript || "").join(" ").trim()
      const interim = results.filter((result) => !result.isFinal).map((result) => result[0]?.transcript || "").join(" ").trim()
      finalTextRef.current = final
      interimTextRef.current = interim
      setPrompt([baseTextRef.current, final, interim].filter(Boolean).join(" ").slice(0, 10000))
    }
    recognition.onerror = (event) => {
      if (event.error === "no-speech" && shouldListenRef.current) return
      shouldListenRef.current = false
      setListening(false)
      setMessage("O microfone parou. O texto já reconhecido foi preservado; confira a permissão do navegador ou tente de novo.")
    }
    recognition.onend = () => {
      baseTextRef.current = [baseTextRef.current, finalTextRef.current, interimTextRef.current].filter(Boolean).join(" ").slice(0, 10000)
      finalTextRef.current = ""
      interimTextRef.current = ""
      setPrompt(baseTextRef.current)
      if (shouldListenRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (!shouldListenRef.current) return
          try { recognition.start() } catch { shouldListenRef.current = false; setListening(false); setMessage("A gravação foi interrompida. O texto foi mantido; toque em Iniciar para continuar.") }
        }, 300)
      } else { setListening(false) }
    }
    try { recognition.start(); setListening(true); setMessage("Ouvindo. Pode fazer pausas; toque em Parar quando terminar.") }
    catch { shouldListenRef.current = false; recognitionRef.current = null; setMessage("Não foi possível ligar o microfone.") }
  }

  function stopListening() {
    shouldListenRef.current = false
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.stop() } catch { /* A gravação pode ter encerrado sozinha. */ }
    setListening(false)
    setMessage("Gravação encerrada. Revise o texto e toque em Gerar prévia.")
  }

  async function send(action: "preview" | "apply") {
    setBusy(true); setMessage("")
    if (action === "preview") { setPlan(null); setPreviewToken(""); setSaved(false) }
    try {
      const response = await fetch("/api/admin/ai/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "preview" ? { action, prompt } : { action, plan, previewToken }) })
      const rawResponse = await response.text()
      let data: { error?: string; plan?: SetupPlan; previewToken?: string; createdProducts?: number; updatedProducts?: number; visibleProducts?: number; logoAnalyzed?: boolean }
      try { data = JSON.parse(rawResponse) } catch {
        throw new Error(`O servidor não respondeu corretamente (HTTP ${response.status}). Aguarde alguns segundos e tente novamente.`)
      }
      if (!response.ok) throw new Error(data.error || "Não foi possível completar o pedido.")
      if (action === "preview") { if (!data.plan || !data.previewToken) throw new Error("A IA não devolveu uma prévia completa. Tente novamente."); setPlan(data.plan); setPreviewToken(data.previewToken); setLogoAnalyzed(Boolean(data.logoAnalyzed)); setMessage("Confira a prévia. Você pode corrigir textos, preços e alterações antes de publicar.") }
      else { await onApplied?.().catch(() => undefined); setSavedCaptions(plan?.captions || []); setPlan(null); setPreviewToken(""); setSaved(true); setMessage(`Publicado: ${data.createdProducts || 0} produto(s) novos e ${data.updatedProducts || 0} atualizados. Abra a loja para conferir textos, cores e cardápio.`) }
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
      <p className="mt-2 text-sm text-gray-600">Peça por texto ou voz mudanças na página inicial, perfil da loja, cores, categorias, produtos, sabores e sugestões de legendas. A IA mostra tudo para sua aprovação antes de publicar.</p>
      <p className="mt-2 text-xs text-gray-500">Se a logo já estiver salva em Configurações, a IA tenta analisar suas cores. Pedidos fora destas áreas aparecem como não disponíveis na prévia.</p>
      <p className="mt-2 text-xs text-gray-500">Exemplo: Minha loja é Cris Salgados. Crie um combo com 4 salgados, escolha obrigatória de no mínimo 4 sabores e máximo de 4 por unidade. Sabores: frango, carne, pizza. Se comprar 2 combos, poderá escolher até 8. Sugira refrigerante junto do combo.</p>
      <textarea className={`${input} mt-4 min-h-32`} value={prompt} maxLength={10000} disabled={listening} onChange={(event) => { setPrompt(event.target.value); setPlan(null); setPreviewToken("") }} placeholder="Escreva ou dite aqui o que quer cadastrar..." aria-label="Descrição da loja para a IA" />
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={listening || busy} onClick={startListening} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"><Mic className="h-4 w-4"/> Iniciar gravação</button><button type="button" disabled={!listening} onClick={stopListening} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"><Square className="h-4 w-4"/> Parar gravação</button><button type="button" disabled={busy || listening || prompt.trim().length < 12} onClick={() => send("preview")} className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? "Preparando..." : "Gerar prévia"}</button></div>
      {message && <p role="status" className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-950">{message}</p>}
      {saved && <a href={publicStorePath} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-green-700 px-4 py-2 text-sm font-black text-white">Abrir página da loja ↗</a>}
      {saved && savedCaptions.length > 0 && <div className="mt-4 space-y-2"><strong className="text-sm">Legendas sugeridas para copiar</strong>{savedCaptions.map((caption, index) => <div key={index} className="rounded-lg bg-gray-50 p-3 text-sm"><p>{caption}</p><button type="button" className="mt-1 text-xs font-bold text-orange-700" onClick={() => navigator.clipboard.writeText(caption)}>Copiar</button></div>)}</div>}
    </section>
    {plan && <div className="space-y-5">
      <section className="rounded-3xl border border-orange-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Como o cliente verá a página</h3><p className="text-xs text-gray-500">A página inicial real da loja com as alterações propostas. Nada foi publicado ainda.</p></div><div className="flex gap-2"><button type="button" onClick={() => setPreviewWidth("phone")} className={`rounded-lg px-3 py-2 text-xs font-bold ${previewWidth === "phone" ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700"}`}>Celular</button><button type="button" onClick={() => setPreviewWidth("desktop")} className={`rounded-lg px-3 py-2 text-xs font-bold ${previewWidth === "desktop" ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700"}`}>Computador</button></div></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 p-2 sm:p-4"><iframe ref={previewRef} title="Prévia visual da página inicial da loja" src="/admin/ai-preview" onLoad={() => previewRef.current?.contentWindow?.postMessage({ type: "saborflow:ai-landing-preview", settings: currentSettings, products: availableProducts, plan, basePath: publicStorePath }, window.location.origin)} className={`mx-auto block h-[640px] rounded-xl border border-gray-200 bg-white shadow-lg transition-[width] ${previewWidth === "phone" ? "w-full max-w-[390px]" : "w-full"}`} /></div>
        <p className="mt-2 text-xs text-gray-500">Role dentro da página para ver o restante. Os links estão desativados nesta visualização.</p>
      </section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">O que muda e onde editar manualmente</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[550px] text-left text-xs"><thead><tr className="border-b text-gray-500"><th className="py-2">Área no admin</th><th>Antes</th><th>Depois da aprovação</th></tr></thead><tbody>{Object.entries(plan.store).filter(([, value]) => value !== "" && value !== null).map(([key, value]) => { const settingKey = key === "name" ? "storeName" : key; const oldValue = currentSettings[settingKey as keyof StoreSettings]; const area = key === "instagramUrl" ? "Links › Instagram" : key.toLowerCase().includes("color") ? "Configurações › Cores" : "Configurações › Página inicial"; return <tr key={key} className="border-b align-top"><td className="py-2 pr-3 font-bold">{area} · {settingLabels[key as keyof SetupPlan["store"]]}</td><td className="max-w-48 break-words pr-3 text-gray-500">{String(oldValue || "—")}</td><td className="max-w-56 break-words font-semibold">{String(value)}</td></tr> })}{plan.operations.businessHours && <tr className="border-b"><td className="py-2 font-bold">Configurações › Funcionamento</td><td>Horários atuais</td><td>Turnos mostrados abaixo</td></tr>}{plan.productEdits.length > 0 && <tr className="border-b"><td className="py-2 font-bold">Produtos e sabores</td><td>Produtos atuais</td><td>{plan.productEdits.length} produto(s) ajustado(s)</td></tr>}{plan.products.length > 0 && <tr><td className="py-2 font-bold">Produtos e sabores</td><td>Catálogo atual</td><td>{plan.products.length} produto(s) da prévia</td></tr>}</tbody></table></div></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Página inicial e perfil da loja</h3><p className="mb-4 text-xs text-gray-500">{logoAnalyzed ? "A logo cadastrada foi analisada para sugerir cores." : "A logo não pôde ser analisada. Para usar suas cores, cadastre uma imagem em Configurações e gere a prévia novamente."} Campos vazios permanecem como estão. As fotos você adiciona nas Configurações.</p><div className="grid gap-3 sm:grid-cols-2">
        {([ ["name","Nome da loja"], ["slogan","Slogan ou bio curta"], ["welcomeTitle","Título principal"], ["welcomeText","Texto principal"], ["aboutTitle","Título Sobre"], ["aboutText","Texto Sobre"], ["primaryColor","Cor principal (#RRGGBB)"], ["secondaryColor","Cor secundária (#RRGGBB)"], ["phone","Telefone"], ["whatsapp","WhatsApp"], ["instagramUrl","Link do Instagram"], ["openingHours","Horário em texto"] ] as Array<[Exclude<keyof SetupPlan["store"], "clientAccountsEnabled">,string]>).map(([key,label]) => <label key={key} className="block text-xs font-bold">{label}<input className={`${input} mt-1`} value={plan.store[key]} onChange={(e) => editStore(key,e.target.value)} /></label>)}
        <label className="block text-xs font-bold">Área do cliente<select className={`${input} mt-1`} value={plan.store.clientAccountsEnabled === null ? "keep" : plan.store.clientAccountsEnabled ? "on" : "off"} onChange={(e) => setPlan((old) => old ? { ...old, store: { ...old.store, clientAccountsEnabled: e.target.value === "keep" ? null : e.target.value === "on" } } : old)}><option value="keep">Manter como está</option><option value="on">Ativar cadastro dos clientes</option><option value="off">Desativar cadastro dos clientes</option></select></label>
      </div></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Categorias ({plan.categories.length})</h3><div className="mt-3 flex flex-wrap gap-2">{plan.categories.map((name,index) => <input key={index} aria-label={`Categoria ${index+1}`} className="w-40 rounded-xl border p-2 text-sm" value={name} onChange={(e) => setPlan({ ...plan, categories: plan.categories.map((v,i) => i === index ? e.target.value : v) })}/>)}</div><p className="mt-2 text-xs text-gray-500">Ao alterar o nome de uma categoria, ajuste a categoria dos produtos abaixo.</p></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Sabores e complementos ({plan.groups.length})</h3><div className="mt-3 space-y-4">{plan.groups.map((group,index) => <div key={index} className="rounded-2xl bg-gray-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Título do grupo<input className={`${input} mt-1`} value={group.name} onChange={(e) => editGroup(index,{ name:e.target.value })}/></label><label className="text-xs font-bold">Modo<select className={`${input} mt-1`} value={group.selectionMode} onChange={(e) => editGroup(index,{selectionMode:e.target.value as "bundle" | "unique"})}><option value="unique">Complementos distintos</option><option value="bundle">Combo: sabores repetíveis</option></select></label><label className="text-xs font-bold">Mínimo por unidade<input type="number" min="0" className={`${input} mt-1`} value={group.minSelect} onChange={(e) => editGroup(index,{minSelect:Number(e.target.value)})}/></label><label className="text-xs font-bold">Máximo por unidade<input type="number" min="1" className={`${input} mt-1`} value={group.maxSelect} onChange={(e) => editGroup(index,{maxSelect:Number(e.target.value)})}/></label></div><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={group.required} onChange={(e) => editGroup(index,{required:e.target.checked})}/> Obrigatório</label><div className="mt-3 grid gap-2 sm:grid-cols-2">{group.options.map((option,optIndex) => <div key={optIndex} className="flex gap-2"><input aria-label={`Opção ${optIndex+1}`} className={input} value={option.name} onChange={(e) => editGroup(index,{options:group.options.map((o,i)=> i===optIndex?{...o,name:e.target.value}:o)})}/><input aria-label={`Preço adicional ${option.name}`} title="Preço adicional" type="number" step="0.01" min="0" className="w-20 rounded-xl border px-2 text-sm" value={option.priceDelta} onChange={(e) => editGroup(index,{options:group.options.map((o,i)=>i===optIndex?{...o,priceDelta:Number(e.target.value)}:o)})}/></div>)}</div><button type="button" onClick={() => editGroup(index,{options:[...group.options,{name:"",priceDelta:0}]})} className="mt-2 text-xs font-bold text-orange-700">+ Opção</button></div>)}</div></section>
      <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Produtos e sugestões ({plan.products.length})</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{plan.products.map((product,index) => <article key={index} className="rounded-2xl border p-4"><label className="text-xs font-bold">Produto<input className={`${input} mt-1`} value={product.name} onChange={(e) => editProduct(index,{name:e.target.value})}/></label><label className="mt-2 block text-xs font-bold">Descrição<input className={`${input} mt-1`} value={product.description} onChange={(e) => editProduct(index,{description:e.target.value})}/></label><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs font-bold">Categoria<select className={`${input} mt-1`} value={product.category} onChange={(e) => editProduct(index,{category:e.target.value})}>{plan.categories.map((c,i)=><option key={i} value={c}>{c}</option>)}</select></label><label className="text-xs font-bold">Preço em R$<input type="number" min="0" step="0.01" className={`${input} mt-1`} value={product.price} onChange={(e) => editProduct(index,{price:Number(e.target.value)})}/></label></div><label className="mt-2 block text-xs font-bold">Grupos (separados por vírgula)<input className={`${input} mt-1`} value={product.groups.join(", ")} onChange={(e)=>editProduct(index,{groups:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></label><label className="mt-2 block text-xs font-bold">Sugestões (nomes separados por vírgula)<input className={`${input} mt-1`} value={product.suggestions.join(", ")} onChange={(e)=>editProduct(index,{suggestions:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})}/></label><label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={product.featured} onChange={(e)=>editProduct(index,{featured:e.target.checked})}/> Destaque na página inicial</label></article>)}</div></section>
      {(plan.operations?.businessHours || Object.entries(plan.operations || {}).some(([key, value]) => key !== "businessHours" && value !== null)) && <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Funcionamento da loja</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">{([ ["acceptingOrders", "Aceitar pedidos"], ["pickupEnabled", "Retirada"], ["deliveryEnabled", "Entrega"] ] as const).map(([key, label]) => <label key={key} className="text-xs font-bold">{label}<select className={`${input} mt-1`} value={plan.operations[key] === null ? "keep" : plan.operations[key] ? "on" : "off"} onChange={(event) => setPlan((current) => current ? { ...current, operations: { ...current.operations, [key]: event.target.value === "keep" ? null : event.target.value === "on" } } : current)}><option value="keep">Manter como está</option><option value="on">Ativar</option><option value="off">Desativar</option></select></label>)}</div>{plan.operations.businessHours && <div className="mt-4 space-y-2"><p className="text-sm font-bold">Horários por dia</p>{plan.operations.businessHours.map((day, index) => <div key={day.day} className="grid grid-cols-[1fr_1fr_1fr] gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr]"><label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={day.enabled} onChange={(event) => setPlan((current) => current ? { ...current, operations: { ...current.operations, businessHours: current.operations.businessHours?.map((item, position) => position === index ? { ...item, enabled: event.target.checked } : item) || null } } : current)} />{day.label}</label>{([ ["open", "Abre"], ["pauseStart", "Pausa"], ["pauseEnd", "Volta"], ["close", "Fecha"] ] as const).map(([key, label]) => <label key={key} className="text-xs font-bold">{label}<input type="time" value={day[key] || ""} onChange={(event) => setPlan((current) => current ? { ...current, operations: { ...current.operations, businessHours: current.operations.businessHours?.map((item, position) => position === index ? { ...item, [key]: event.target.value } : item) || null } } : current)} className="mt-1 w-full rounded-lg border px-1 py-2 text-xs" /></label>)}</div>)}</div>}</section>}
      {plan.productEdits.length > 0 && <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Produtos existentes que serão alterados ({plan.productEdits.length})</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{plan.productEdits.map((edit, index) => <article key={edit.id} className="rounded-xl border p-4"><strong>{edit.name}</strong><label className="mt-2 block text-xs font-bold">Nova descrição (vazio = manter)<textarea className={`${input} mt-1`} value={edit.description ?? ""} onChange={(event) => setPlan((current) => current ? { ...current, productEdits: current.productEdits.map((item, position) => position === index ? { ...item, description: event.target.value || null } : item) } : current)} /></label><label className="mt-2 block text-xs font-bold">Destaque na loja<select className={`${input} mt-1`} value={edit.featured === null ? "keep" : edit.featured ? "yes" : "no"} onChange={(event) => setPlan((current) => current ? { ...current, productEdits: current.productEdits.map((item, position) => position === index ? { ...item, featured: event.target.value === "keep" ? null : event.target.value === "yes" } : item) } : current)}><option value="keep">Manter como está</option><option value="yes">Destacar</option><option value="no">Não destacar</option></select></label><label className="mt-2 block text-xs font-bold">Novo preço (vazio = manter)<input type="number" min="0" step="0.01" className={`${input} mt-1`} value={edit.price ?? ""} onChange={(event) => setPlan((current) => current ? { ...current, productEdits: current.productEdits.map((item, position) => position === index ? { ...item, price: event.target.value ? Number(event.target.value) : null } : item) } : current)} /></label><label className="mt-2 block text-xs font-bold">Novos grupos deste plano para adicionar<input className={`${input} mt-1`} value={edit.groups.join(", ")} onChange={(event) => setPlan((current) => current ? { ...current, productEdits: current.productEdits.map((item, position) => position === index ? { ...item, groups: event.target.value.split(",").map((name) => name.trim()).filter(Boolean) } : item) } : current)} placeholder="Separe nomes por vírgula" /></label><div className="mt-2 text-xs"><strong>Sugerir junto do pedido:</strong><p className="mt-1">{edit.recommendationIds.map((id) => availableProducts.find((product) => product.id === id)?.name || `Produto #${id}`).join(", ") || "Nenhum novo"}</p><select className={`${input} mt-1`} value="" onChange={(event) => { const id = Number(event.target.value); if (id) setPlan((current) => current ? { ...current, productEdits: current.productEdits.map((item, position) => position === index && !item.recommendationIds.includes(id) ? { ...item, recommendationIds: [...item.recommendationIds, id] } : item) } : current) }}><option value="">Adicionar sugestão...</option>{availableProducts.filter((product) => product.id !== edit.id && !edit.recommendationIds.includes(product.id)).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>{edit.recommendationIds.length > 0 && <button type="button" className="mt-2 text-red-600" onClick={() => setPlan((current) => current ? { ...current, productEdits: current.productEdits.map((item, position) => position === index ? { ...item, recommendationIds: [] } : item) } : current)}>Limpar sugestões deste plano</button>}</div></article>)}</div></section>}
      {plan.captions.length > 0 && <section className="rounded-3xl border bg-white p-5"><h3 className="font-black">Legendas sugeridas</h3><p className="mt-1 text-xs text-gray-500">Estas legendas podem ser copiadas; não são publicadas no Instagram automaticamente.</p><div className="mt-3 space-y-2">{plan.captions.map((caption, index) => <div key={index} className="rounded-xl bg-gray-50 p-3 text-sm"><p>{caption}</p><button type="button" onClick={() => navigator.clipboard.writeText(caption)} className="mt-2 text-xs font-bold text-orange-700">Copiar legenda</button></div>)}</div></section>}
      {plan.unsupported.length > 0 && <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-black text-amber-950">Pedidos que precisam de outro passo</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{plan.unsupported.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
      <div className="sticky bottom-4 rounded-2xl border bg-white p-4 shadow-xl"><p className="mb-2 text-xs text-gray-600">Revise os textos, as cores e os preços. Produto novo sem preço precisa de um valor antes de ser publicado.</p><button type="button" disabled={busy} onClick={() => send("apply")} className="w-full rounded-xl bg-green-700 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? "Salvando..." : "Aprovar e publicar as alterações"}</button></div>
    </div>}
  </div>
}
