"use client"

import Script from "next/script"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Building2, Check, CreditCard, LoaderCircle, LockKeyhole, LogIn, Mail, QrCode, ReceiptText, ShieldCheck, UserRound } from "lucide-react"
import type { BillingCycle, CommercialBillingStatus, CommercialPlan, PaymentMethod } from "@/lib/billing-types"
import { EARLY_TERMINATION_PENALTY_PERCENT, commercialCycleTerms } from "@/lib/commercial-contract"

function money(cents: number | null, currency: string) {
  if (cents == null) return "Indisponível"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100)
}

function limit(value: number | null) {
  return value === null ? "Ilimitado" : String(value)
}

function onlyDigits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max)
}

function formatCpf(value: string) {
  const digits = onlyDigits(value, 11)
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

function formatCnpj(value: string) {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14)

  const base = raw.slice(0, 12)
  const verificationDigits = raw
    .slice(12)
    .replace(/\D/g, "")
    .slice(0, 2)

  const cnpj = `${base}${verificationDigits}`

  return cnpj
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, "$1.$2.$3")
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})([A-Z0-9])/, "$1.$2.$3/$4")
    .replace(/(\/[A-Z0-9]{4})(\d)/, "$1-$2")
}

export function CommercialCheckout() {
  const searchParams = useSearchParams()
  const selectedPlanCode = (searchParams.get("plano") || "").trim().toLowerCase()
  const selectedCycleParam = (searchParams.get("ciclo") || "").trim().toLowerCase()
  const initialCycle: BillingCycle = selectedCycleParam === "semiannual" || selectedCycleParam === "annual" ? selectedCycleParam : "monthly"
  const [plans, setPlans] = useState<CommercialPlan[]>([])
  const [status, setStatus] = useState<CommercialBillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"signup" | "signin">("signup")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cpf, setCpf] = useState("")
  const [hasCnpj, setHasCnpj] = useState(true)
  const [cnpj, setCnpj] = useState("")
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [contractAccepted, setContractAccepted] = useState(false)
  const [commitmentAccepted, setCommitmentAccepted] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleFlowRef = useRef({ mode, cpf, hasCnpj, cnpj, legalAccepted })
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  useEffect(() => {
    googleFlowRef.current = { mode, cpf, hasCnpj, cnpj, legalAccepted }
  }, [mode, cpf, hasCnpj, cnpj, legalAccepted])

  async function load() {
    setLoading(true)
    try {
      const [plansResponse, statusResponse] = await Promise.all([
        fetch("/api/billing/plans", { cache: "no-store" }),
        fetch("/api/billing/status", { cache: "no-store" }),
      ])
      const plansPayload = await plansResponse.json()
      if (!plansResponse.ok) throw new Error(plansPayload.error || "Não foi possível carregar os planos.")
      setPlans(plansPayload.plans || [])
      if (statusResponse.ok) setStatus(await statusResponse.json())
      else setStatus(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar contratação.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const hasSemiannual = useMemo(() => plans.some((plan) => plan.semiannualPriceCents != null), [plans])
  const hasAnnual = useMemo(() => plans.some((plan) => plan.annualPriceCents != null), [plans])

  async function authenticate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const endpoint = mode === "signup" ? "/api/billing/signup" : "/api/billing/sign-in"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { name, email, password, cpf, hasCnpj, cnpj, legalAccepted }
            : { email, password },
        ),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível continuar.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível continuar.")
    } finally {
      setBusy(false)
    }
  }

  async function authenticateWithGoogle(credential: string) {
    const flow = googleFlowRef.current
    if (flow.mode === "signup" && !flow.legalAccepted) {
      setError("Leia e aceite os Termos de Uso e o Aviso de Privacidade para criar a conta.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/billing/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: flow.mode,
          credential,
          cpf: flow.cpf,
          hasCnpj: flow.hasCnpj,
          cnpj: flow.cnpj,
          legalAccepted: flow.legalAccepted,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível continuar com Google.")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível continuar com Google.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!googleReady || !googleClientId || !googleButtonRef.current || !window.google) return
    googleButtonRef.current.innerHTML = ""
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response: { credential: string }) => void authenticateWithGoogle(response.credential),
    })
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 400,
      shape: "rectangular",
      text: "continue_with",
      locale: "pt-BR",
    })
  }, [googleReady, googleClientId])

  async function checkout(planCode: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle: cycle, paymentMethod, contractAccepted, commitmentAccepted: cycle === "monthly" ? true : commitmentAccepted }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Não foi possível iniciar o pagamento.")
      if (!payload.checkoutUrl) throw new Error("O provedor não retornou o link de pagamento.")
      window.location.assign(payload.checkoutUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar o pagamento.")
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-200 bg-white p-10 text-sm font-bold text-gray-600"><LoaderCircle className="h-5 w-5 animate-spin" />Carregando contratação...</div>
  }

  return (
    <div className="space-y-6">
      {googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {!status?.authenticated ? (
        <section className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${mode === "signup" ? "bg-white shadow-sm" : "text-gray-500"}`}>Criar conta</button>
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-black ${mode === "signin" ? "bg-white shadow-sm" : "text-gray-500"}`}>Já tenho conta</button>
          </div>

          {mode === "signup" && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-black text-gray-900">Identificação do responsável</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">O CPF é obrigatório para o dono ou administrador responsável pela conta. Nesta etapa validamos os dígitos do documento; a consulta oficial à base cadastral será conectada separadamente.</p>
                </div>
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">CPF do responsável</span>
                <input required inputMode="numeric" autoComplete="off" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 outline-none focus:border-amber-500" />
              </label>

              <div className="mt-4">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">A empresa possui CNPJ?</span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setHasCnpj(true)} className={`h-11 rounded-xl border text-sm font-black ${hasCnpj ? "border-amber-500 bg-white text-amber-800 shadow-sm" : "border-gray-200 bg-white/60 text-gray-500"}`}>Sim, possui</button>
                  <button type="button" onClick={() => { setHasCnpj(false); setCnpj("") }} className={`h-11 rounded-xl border text-sm font-black ${!hasCnpj ? "border-amber-500 bg-white text-amber-800 shadow-sm" : "border-gray-200 bg-white/60 text-gray-500"}`}>Ainda não</button>
                </div>
              </div>

              {hasCnpj && (
                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">CNPJ da empresa</span>
                  <div className="relative"><Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={18} value={cnpj} onChange={(event) => setCnpj(formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 outline-none focus:border-amber-500" /></div>
                </label>
              )}
            </div>
          )}

          {mode === "signup" && (
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-600">
              <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" />
              <span>Li e concordo com os <Link href="/termos" target="_blank" className="font-black text-amber-700 underline">Termos de Uso</Link> e declaro ciência do <Link href="/privacidade" target="_blank" className="font-black text-amber-700 underline">Aviso de Privacidade</Link>.</span>
            </label>
          )}

          {googleClientId && (
            <div className="mt-6">
              <div ref={googleButtonRef} className="flex min-h-11 justify-center" />
              {mode === "signup" && <p className="mt-2 text-center text-[11px] leading-4 text-gray-500">Preencha CPF/CNPJ e confirme os documentos legais antes de continuar com Google.</p>}
              <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200" /><span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">ou use e-mail e senha</span><div className="h-px flex-1 bg-gray-200" /></div>
            </div>
          )}

          <form onSubmit={authenticate} className={googleClientId ? "space-y-4" : "mt-6 space-y-4"}>
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Nome do responsável</span>
                <div className="relative"><UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3 outline-none focus:border-amber-500" /></div>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">E-mail</span>
              <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3 outline-none focus:border-amber-500" /></div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Senha</span>
              <div className="relative"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-gray-200 pl-9 pr-3 outline-none focus:border-amber-500" /></div>
            </label>
            <button disabled={busy || (mode === "signup" && !legalAccepted)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{mode === "signup" ? "Criar conta e escolher plano" : "Entrar para contratar"}</button>
          </form>
        </section>
      ) : (
        <>
          {status.billing?.subscription?.status === "active" && !status.billing.subscription.internal && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Sua assinatura <strong>{status.billing.subscription.planName}</strong> já está ativa. {status.hasOrganization ? <a href="/admin" className="underline">Voltar ao painel</a> : <a href="/admin/nova-empresa" className="underline">Configurar sua primeira loja</a>}.</div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-black uppercase tracking-wider text-gray-400">Conta contratante</p><p className="font-bold text-gray-900">{status.email}</p></div>
              <div className="flex flex-wrap rounded-xl bg-gray-100 p-1">
                <button onClick={() => { setCycle("monthly"); setContractAccepted(false); setCommitmentAccepted(false) }} className={`rounded-lg px-4 py-2 text-sm font-black ${cycle === "monthly" ? "bg-white shadow-sm" : "text-gray-500"}`}>Mensal</button>
                {hasSemiannual && <button onClick={() => { setCycle("semiannual"); setContractAccepted(false); setCommitmentAccepted(false) }} className={`rounded-lg px-4 py-2 text-sm font-black ${cycle === "semiannual" ? "bg-white shadow-sm" : "text-gray-500"}`}>Semestral</button>}
                {hasAnnual && <button onClick={() => { setCycle("annual"); setContractAccepted(false); setCommitmentAccepted(false) }} className={`rounded-lg px-4 py-2 text-sm font-black ${cycle === "annual" ? "bg-white shadow-sm" : "text-gray-500"}`}>Anual</button>}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {([
                ["pix", QrCode, "Pix", "Pagamento rápido"],
                ["credit_card", CreditCard, "Cartão", "Cobrança recorrente"],
                ["boleto", ReceiptText, "Boleto", "Cobrança tradicional"],
              ] as const).map(([value, Icon, label, caption]) => (
                <button key={value} type="button" onClick={() => setPaymentMethod(value)} className={`rounded-2xl border p-4 text-left transition ${paymentMethod === value ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100" : "border-gray-200 bg-white hover:border-orange-200"}`}>
                  <Icon className="h-5 w-5 text-orange-600" />
                  <p className="mt-2 text-sm font-black text-gray-950">{label}</p>
                  <p className="mt-1 text-xs text-gray-500">{caption}</p>
                </button>
              ))}
            </div>
          </div>

          {cycle !== "monthly" && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-black">Contrato com permanência mínima de {commercialCycleTerms(cycle).commitmentMonths} meses</p>
                  <p className="mt-1">Em caso de cancelamento antecipado, poderá ser cobrada multa de <strong>{EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo das mensalidades que ainda faltarem</strong>, observados os limites legais e as hipóteses de isenção previstas em lei.</p>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-sm leading-6 text-gray-700">
            <input type="checkbox" checked={contractAccepted} onChange={(event) => setContractAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" />
            <span>Li e aceito o <Link href="/contrato-assinatura" target="_blank" className="font-black text-orange-700 underline">Contrato de Licença e Assinatura</Link>, os <Link href="/termos" target="_blank" className="font-black text-orange-700 underline">Termos de Uso</Link> e o <Link href="/privacidade" target="_blank" className="font-black text-orange-700 underline">Aviso de Privacidade</Link>, incluindo valores, período escolhido e, quando aplicável, a regra de multa de 30% sobre o saldo vincendo na rescisão antecipada.</span>
          </label>

          {cycle !== "monthly" && (
            <label className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <input type="checkbox" checked={commitmentAccepted} onChange={(event) => setCommitmentAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-700" />
              <span><strong>Confirmação de permanência:</strong> estou ciente de que o plano {cycle === "annual" ? "anual" : "semestral"} possui permanência mínima de {commercialCycleTerms(cycle).commitmentMonths} meses e que, se eu solicitar rescisão antecipada sem hipótese legal de isenção, poderá ser cobrada multa de <strong>{EARLY_TERMINATION_PENALTY_PERCENT}% sobre o saldo das mensalidades ainda vincendas</strong>.</span>
            </label>
          )}

          {plans.length === 0 ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900">Nenhum plano comercial foi publicado ainda. A infraestrutura de cobrança está pronta, mas preço e limites precisam ser definidos pelo operador do SaborFlow antes de abrir vendas.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => {
                const price = cycle === "annual" ? plan.annualPriceCents : cycle === "semiannual" ? plan.semiannualPriceCents : plan.monthlyPriceCents
                const terms = commercialCycleTerms(cycle)
                const selected = selectedPlanCode === plan.code.toLowerCase() || plans.length === 1
                return (
                  <article key={plan.id} className={`flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${selected ? "border-orange-400 ring-2 ring-orange-100" : "border-gray-200"}`}>
                    {selected && <p className="mb-3 inline-flex w-fit rounded-full bg-orange-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-800">SaborFlow completo</p>}
                    <h2 className="text-xl font-black text-gray-950">{plan.name}</h2>
                    <p className="mt-2 min-h-10 text-sm text-gray-600">{plan.description}</p>
                    <p className="mt-5 text-3xl font-black text-gray-950">{money(terms.installmentCents, plan.currency)}<span className="text-sm font-black text-gray-400">/mês</span></p>
                    <p className="mt-1 text-xs font-bold text-gray-500">{cycle === "monthly" ? "Cobrança mensal, sem fidelidade" : `${terms.commitmentMonths} meses de compromisso · total contratual ${money(price, plan.currency)}`}</p>
                    <div className="mt-5 space-y-2 text-sm text-gray-700">
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />{limit(plan.entitlements.maxOrganizations)} loja principal</p>
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Usuários e produtos conforme o plano completo</p>
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Delivery, cozinha, financeiro, clientes e relatórios</p>
                      <p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />IA de configuração contratada separadamente</p>
                    </div>
                    <button disabled={busy || price == null || !contractAccepted || (cycle !== "monthly" && !commitmentAccepted)} onClick={() => void checkout(plan.code)} className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-950 text-sm font-black text-white hover:bg-black disabled:opacity-40"><CreditCard className="h-4 w-4" />Ir para pagamento</button>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
