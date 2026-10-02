"use client"
import Link from "next/link"
import { useRef, useState, type FormEvent } from "react"
import { ArrowRight, Check, LoaderCircle } from "lucide-react"
import { businessSegments, dailyOrderRanges, parseBasicTrialProfile, systemExperiences, type BasicTrialProfile } from "@/lib/basic-trial"
const inputClass = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
export function BasicTrialSignup({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<"signup" | "signin">("signup")
  const [authenticated, setAuthenticated] = useState(signedIn)
  const [profile, setProfile] = useState<BasicTrialProfile>({ storeName: "", segment: "", experience: "", dailyOrders: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const focusHeading = () => requestAnimationFrame(() => heading.current?.focus())
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { parseBasicTrialProfile(profile); setError(""); setStep(2); focusHeading() } catch (e) { setError(e instanceof Error ? e.message : "Confira as respostas.") }
  }
  async function send(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || "Não foi possível continuar. Tente novamente.")
    return data as { redirectTo?: string }
  }
  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    setBusy(true); setError("")
    try {
      if (!authenticated) {
        await send(mode === "signup" ? "/api/billing/signup" : "/api/billing/sign-in", { name: values.get("name"), cpf: values.get("cpf"), email: values.get("email"), password: values.get("password"), legalAccepted: values.get("legal") === "on", hasCnpj: false })
        setAuthenticated(true)
      }
      const result = await send("/api/demo/trial/start", profile.storeName.trim() ? { profile } : { resumeOnly: true })
      if (!result.redirectTo?.startsWith("/admin")) throw new Error("O teste não retornou um painel válido. Tente novamente.")
      window.location.assign(result.redirectTo)
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível conectar ao servidor."); setBusy(false) }
  }
  return <section className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-xl shadow-orange-950/5 sm:p-8" aria-label="Cadastro do teste grátis">
    <div className="flex items-center justify-between text-sm font-bold"><span className="text-orange-700">7 dias grátis · sua própria conta</span><span className="text-stone-500">Etapa {step} de 2</span></div>
    <div aria-hidden="true" className="mt-4 flex gap-2"><span className="h-1 flex-1 rounded bg-orange-600" /><span className={`h-1 flex-1 rounded ${step === 2 ? "bg-orange-600" : "bg-stone-200"}`} /></div>
    <h2 ref={heading} tabIndex={-1} className="mt-6 text-2xl font-black outline-none">{step === 1 ? "Conte um pouco da sua loja" : authenticated ? "Tudo pronto para começar" : mode === "signup" ? "Crie seu acesso" : "Entre para continuar"}</h2>
    <p className="mt-2 text-sm leading-6 text-stone-500">{step === 1 ? "Estas respostas ajudam a conhecer sua operação." : authenticated ? "Sua conta continuará sendo a mesma durante e depois do teste." : mode === "signup" ? "O e-mail e a senha abaixo serão seu acesso ao SaborFlow sempre que voltar." : "Entre com o mesmo e-mail e senha usados no cadastro."}</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {step === 1 ? <form onSubmit={next} className="mt-6 space-y-5">
      <label className="block text-sm font-bold">Nome da loja<input className={inputClass} value={profile.storeName} onChange={e => setProfile({ ...profile, storeName: e.target.value })} required minLength={2} maxLength={80} autoComplete="organization" placeholder="Ex.: Delícias da Ana" /></label>
      {([['segment', 'Qual é o seu ramo?', businessSegments], ['experience', 'Você já utilizou um sistema?', systemExperiences], ['dailyOrders', 'Quantos pedidos você recebe por dia?', dailyOrderRanges]] as const).map(([key, label, choices]) => <label key={key} className="block text-sm font-bold">{label}<select className={inputClass} required value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })}><option value="">Selecione uma opção</option>{choices.map(choice => <option key={choice}>{choice}</option>)}</select></label>)}
      <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 font-bold text-white hover:bg-orange-700">Continuar <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" onClick={() => { setMode("signin"); setStep(2); setError(""); focusHeading() }} className="w-full text-sm font-bold text-stone-600 underline">Já iniciei meu teste</button>
    </form> : <form onSubmit={finish} className="mt-6 space-y-4">
      {authenticated ? <div className="rounded-xl bg-orange-50 p-4 text-sm leading-6"><Check className="mb-2 h-5 w-5 text-orange-700" aria-hidden="true" />Conta conectada. Ao continuar, abriremos seu teste ativo ou criaremos o primeiro teste para <strong>{profile.storeName || "sua loja"}</strong>.</div> : <>
        <div className="flex gap-2">{([['signup', 'Criar conta'], ['signin', 'Já tenho conta']] as const).map(([value, label]) => <button key={value} type="button" disabled={busy} onClick={() => { setMode(value); setError("") }} aria-pressed={mode === value} className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold ${mode === value ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-600"}`}>{label}</button>)}</div>
        {mode === "signup" && <><label className="block text-sm font-bold">Seu nome<input name="name" required minLength={2} maxLength={100} autoComplete="name" className={inputClass} disabled={busy} /></label><label className="block text-sm font-bold">CPF do responsável<input name="cpf" required inputMode="numeric" maxLength={14} className={inputClass} disabled={busy} /><span className="mt-1 block text-xs font-normal text-stone-500">Usado para identificar o responsável pela conta.</span></label></>}
        <label className="block text-sm font-bold">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} disabled={busy} /></label>
        <label className="block text-sm font-bold">Senha<input name="password" type="password" required minLength={mode === "signup" ? 12 : 1} maxLength={256} autoComplete={mode === "signup" ? "new-password" : "current-password"} className={inputClass} disabled={busy} />{mode === "signup" && <span className="mt-1 block text-xs font-normal text-stone-500">Use pelo menos 12 caracteres.</span>}</label>
        {mode === "signup" && <label className="flex items-start gap-3 text-sm leading-6 text-stone-600"><input type="checkbox" name="legal" required disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-orange-600" /><span>Li e aceito os <Link target="_blank" href="/termos" className="underline">Termos de Uso</Link> e o <Link target="_blank" href="/privacidade" className="underline">Aviso de Privacidade</Link>.</span></label>}
      </>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 font-bold text-white hover:bg-orange-700 disabled:opacity-60">{busy && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}{busy ? "Preparando sua conta..." : "Entrar no meu painel por 7 dias"}</button>
      <button type="button" disabled={busy} onClick={() => { setStep(1); setError(""); focusHeading() }} className="w-full text-sm font-bold text-stone-500">Voltar às informações da loja</button>
    </form>}
  </section>
}
