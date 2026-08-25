"use client"

import { FormEvent, useEffect, useState } from "react"
import { LogIn, ShieldCheck, UserPlus, X } from "lucide-react"

const LAST_CLIENT_CPF_KEY = "saborflow_client_last_cpf"
const LEGACY_LAST_CLIENT_CPF_KEY = "cris-client-last-cpf"

type CustomerPublic = {
  id: number
  cpfLast4: string
  name: string
  phone: string
  email: string
  defaultAddress: string
  defaultNumber: string
  defaultDistrict: string
  defaultCity: string
  defaultState: string
  defaultZipCode: string
  defaultComplement: string
  defaultLatitude: number | null
  defaultLongitude: number | null
  loyaltyPoints: number
}

export function ClientAccountModal({
  open,
  onClose,
  customer,
  onCustomer,
}: {
  open: boolean
  onClose: () => void
  customer: CustomerPublic | null
  onCustomer: (customer: CustomerPublic | null) => void
}) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [cpf, setCpf] = useState("")
  const [pin, setPin] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = await fetch(mode === "login" ? "/api/client/login" : "/api/client/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { cpf, pin, remember } : { cpf, pin, name, phone, email, remember }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar.")
      onCustomer(data.customer)
      try {
        localStorage.setItem(LAST_CLIENT_CPF_KEY, cpf.replace(/\D/g, ""))
        localStorage.removeItem(LEGACY_LAST_CLIENT_CPF_KEY)
      } catch {}
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch("/api/client/logout", { method: "POST" })
    onCustomer(null)
    onClose()
  }

  useEffect(() => {
    if (customer) return
    try {
      const last = localStorage.getItem(LAST_CLIENT_CPF_KEY) || localStorage.getItem(LEGACY_LAST_CLIENT_CPF_KEY)
      if (last) {
        setCpf(last)
        localStorage.setItem(LAST_CLIENT_CPF_KEY, last)
        localStorage.removeItem(LEGACY_LAST_CLIENT_CPF_KEY)
      }
    } catch {}
  }, [customer])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">Conta do cliente</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">{customer ? `Olá, ${customer.name}` : mode === "login" ? "Entrar rapidamente" : "Criar minha conta"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        {customer ? (
          <div className="space-y-4 p-5">
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5" />Login salvo neste aparelho</div>
              <p className="mt-1 text-sm">Seus dados podem preencher o próximo pedido automaticamente.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 p-4"><p className="text-xs text-gray-500">CPF</p><p className="mt-1 font-black">•••.•••.•••-{customer.cpfLast4}</p></div>
              <div className="rounded-2xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Pontos</p><p className="mt-1 text-xl font-black text-orange-600">{customer.loyaltyPoints}</p></div>
            </div>
            <button type="button" onClick={logout} className="h-11 w-full rounded-xl border border-gray-200 text-sm font-bold text-gray-700">Sair desta conta</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5">
            <div className="mb-4 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm font-bold">
              <button type="button" onClick={() => setMode("login")} className={`rounded-lg px-3 py-2 ${mode === "login" ? "bg-white text-orange-700 shadow-sm" : "text-gray-500"}`}>Já tenho conta</button>
              <button type="button" onClick={() => setMode("register")} className={`rounded-lg px-3 py-2 ${mode === "register" ? "bg-white text-orange-700 shadow-sm" : "text-gray-500"}`}>Criar conta</button>
            </div>
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}
            <div className="space-y-3">
              {mode === "register" && <>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome *" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" />
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp *" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail (opcional)" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" />
              </>}
              <input required inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="CPF (somente números) *" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" />
              <input required inputMode="numeric" type="password" minLength={4} maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} placeholder={mode === "register" ? "Crie um PIN de 4 a 6 números *" : "Seu PIN *"} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" />
              <label className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 h-4 w-4" /><span><strong className="text-gray-800">Manter meu login salvo</strong><br/>Neste aparelho, você não precisará informar CPF e PIN toda vez.</span></label>
            </div>
            <button disabled={busy} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-black text-white disabled:opacity-50">{mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar e entrar"}</button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-400">O CPF identifica sua conta e o PIN protege o acesso. Seus dados podem ser usados para agilizar pedidos e recursos de fidelidade da loja.</p>
          </form>
        )}
      </div>
    </div>
  )
}
