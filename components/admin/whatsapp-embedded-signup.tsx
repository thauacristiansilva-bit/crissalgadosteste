"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, ExternalLink, Loader2, MessageSquare, ShieldCheck } from "lucide-react"

type PublicConfig = {
  ready: boolean
  appId: string
  configId: string
  apiVersion: string
  solutionId: string | null
  appSecretConfigured: boolean
  version: "v4"
}

type SignupSession = {
  wabaId: string
  phoneNumberId: string
  businessId: string | null
}

type FbLoginResponse = {
  authResponse?: { code?: string }
  status?: string
}

type FacebookSdk = {
  init: (options: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void
  login: (
    callback: (response: FbLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void
}

declare global {
  interface Window {
    FB?: FacebookSdk
    fbAsyncInit?: () => void
  }
}

export function WhatsAppEmbeddedSignup({ onConnected }: { onConnected?: () => void }) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const codeRef = useRef("")
  const sessionRef = useRef<SignupSession | null>(null)
  const pinRef = useRef("")
  const completingRef = useRef(false)

  useEffect(() => { pinRef.current = pin }, [pin])

  const completeIfReady = useCallback(async () => {
    const code = codeRef.current
    const signup = sessionRef.current
    const currentPin = pinRef.current.replace(/\D/g, "")
    if (!code || !signup || currentPin.length !== 6 || completingRef.current) return
    completingRef.current = true
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/admin/integrations/whatsapp-embedded-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          wabaId: signup.wabaId,
          phoneNumberId: signup.phoneNumberId,
          businessId: signup.businessId,
          pin: currentPin,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a conexão.")
      const phone = payload.result?.displayPhoneNumber ? ` (${payload.result.displayPhoneNumber})` : ""
      setSuccess(`WhatsApp conectado com sucesso${phone}.`)
      codeRef.current = ""
      sessionRef.current = null
      setPin("")
      onConnected?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a conexão.")
    } finally {
      completingRef.current = false
      setBusy(false)
    }
  }, [onConnected])

  useEffect(() => {
    let alive = true
    fetch("/api/admin/integrations/whatsapp-embedded-signup", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a conexão com a Meta.")
        if (alive) setConfig(payload as PublicConfig)
      })
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : "Erro ao carregar a Meta."))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!config?.ready) return
    const startSdk = () => {
      if (!window.FB) return
      window.FB.init({ appId: config.appId, cookie: true, xfbml: false, version: config.apiVersion })
      setSdkReady(true)
    }
    if (window.FB) {
      startSdk()
      return
    }
    window.fbAsyncInit = startSdk
    const existing = document.getElementById("facebook-jssdk")
    if (!existing) {
      const script = document.createElement("script")
      script.id = "facebook-jssdk"
      script.async = true
      script.defer = true
      script.crossOrigin = "anonymous"
      script.src = "https://connect.facebook.net/pt_BR/sdk.js"
      document.body.appendChild(script)
    }
    return () => {
      if (window.fbAsyncInit === startSdk) delete window.fbAsyncInit
    }
  }, [config])

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (!event.origin?.endsWith("facebook.com")) return
      let data: unknown = event.data
      if (typeof data === "string") {
        try { data = JSON.parse(data) } catch { return }
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) return
      const payload = data as { type?: string; event?: string; data?: Record<string, unknown> }
      if (payload.type !== "WA_EMBEDDED_SIGNUP") return
      if (payload.event === "ERROR") {
        setError(String(payload.data?.error_message || "A Meta informou um erro durante a conexão."))
        return
      }
      if (payload.event === "CANCEL") return
      if (payload.event !== "FINISH" && payload.event !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") return
      const phoneNumberId = String(payload.data?.phone_number_id || "")
      const wabaId = String(payload.data?.waba_id || "")
      const businessId = String(payload.data?.business_id || payload.data?.businessId || "") || null
      if (!phoneNumberId || !wabaId) return
      sessionRef.current = { phoneNumberId, wabaId, businessId }
      void completeIfReady()
    }
    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
  }, [completeIfReady])

  function launch() {
    const safePin = pin.replace(/\D/g, "")
    if (safePin.length !== 6) {
      setError("Crie um PIN de segurança com 6 dígitos antes de conectar.")
      return
    }
    if (!config?.ready || !window.FB || !sdkReady) {
      setError("A conexão oficial da Meta ainda não está pronta.")
      return
    }
    setError("")
    setSuccess("")
    codeRef.current = ""
    sessionRef.current = null
    window.FB.login((response) => {
      const code = String(response.authResponse?.code || "")
      if (!code) {
        if (response.status !== "unknown") setError("A Meta não retornou a autorização necessária.")
        return
      }
      codeRef.current = code
      void completeIfReady()
    }, {
      config_id: config.configId,
      auth_type: "rerequest",
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: config.solutionId ? { solutionID: config.solutionId } : {},
      },
    })
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-emerald-800"><MessageSquare className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.16em]">WhatsApp oficial</span></div>
          <h2 className="mt-2 text-xl font-black text-slate-950">Conecte seu WhatsApp sem tokens ou códigos técnicos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Entre com a Meta, escolha sua empresa e confirme o número. O SaborFlow configura a Cloud API e o webhook automaticamente.</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-xs font-bold text-emerald-800"><ShieldCheck className="mr-1 inline h-4 w-4" />Embedded Signup v4</div>
      </div>

      {!config && !error && <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Verificando configuração da Meta…</div>}

      {config && !config.ready && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">Falta configurar o aplicativo da Meta no Railway.</p>
          <p className="mt-1">Depois de criar a configuração Embedded Signup v4, preencha META_APP_ID, META_APP_SECRET, META_WHATSAPP_CONFIG_ID e META_GRAPH_API_VERSION.</p>
        </div>
      )}

      {config?.ready && (
        <div className="mt-5 grid gap-3 sm:grid-cols-[220px_auto] sm:items-end">
          <label className="text-sm font-bold text-slate-800">PIN de segurança do WhatsApp
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="6 dígitos"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-400"
            />
          </label>
          <button type="button" onClick={launch} disabled={busy || !sdkReady} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {busy ? "Conectando…" : "Conectar meu WhatsApp"}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-slate-500">O PIN tem 6 números e protege o registro do seu número na Cloud API. Guarde esse PIN. A senha do Facebook nunca passa pelo SaborFlow.</p>
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div>}
      {success && <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{success}</div>}
    </section>
  )
}
