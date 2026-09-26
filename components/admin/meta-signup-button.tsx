"use client"

import { useEffect, useRef, useState } from "react"

type Config = { available: boolean; appId: string | null; configId: string | null; apiVersion: string | null }
type FbApi = { init: (options: Record<string, unknown>) => void; login: (callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>) => void }

export function MetaSignupButton({ onConnected }: { onConnected: () => void }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const code = useRef("")
  const selected = useRef<{ wabaId: string; phoneNumberId: string } | null>(null)
  const submitting = useRef(false)
  const cleanup = useRef<() => void>(() => {})
  useEffect(() => () => cleanup.current(), [])

  useEffect(() => {
    let live = true
    fetch("/api/admin/integrations/meta-signup", { cache: "no-store" }).then(response => response.json()).then((value: Config) => { if (live) setConfig(value) }).catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!config?.available || !config.appId || !config.apiVersion) return
    const w = window as Window & { FB?: FbApi; fbAsyncInit?: () => void }
    w.fbAsyncInit = () => { w.FB?.init({ appId: config.appId, cookie: true, xfbml: false, version: config.apiVersion }); setReady(true) }
    if (w.FB) { w.fbAsyncInit(); return }
    const script = document.createElement("script"); script.id = "facebook-jssdk"; script.src = "https://connect.facebook.net/pt_BR/sdk.js"; script.async = true; script.onerror = () => setError("A janela da Meta não carregou. Verifique se o navegador bloqueia pop-ups.")
    if (!document.getElementById(script.id)) document.body.appendChild(script)
  }, [config])

  async function submit() {
    const item = selected.current
    if (!code.current || !item || submitting.current) return
    submitting.current = true
    try {
      const response = await fetch("/api/admin/integrations/meta-signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.current, ...item }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "A Meta não concluiu a conexão.")
      onConnected()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A Meta não concluiu a conexão.") }
    finally { cleanup.current(); submitting.current = false; setBusy(false) }
  }

  function start() {
    const fb = (window as Window & { FB?: FbApi }).FB
    if (!fb || !config?.configId) return
    code.current = ""; selected.current = null; setBusy(true); setError("")
    const timer = window.setTimeout(() => { cleanup.current(); setBusy(false); setError("Tempo esgotado. Tente conectar novamente.") }, 120_000)
    function listener(event: MessageEvent) {
      try {
        const origin = new URL(event.origin)
        if (origin.protocol !== "https:" || !(origin.hostname === "facebook.com" || origin.hostname.endsWith(".facebook.com"))) return
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return
        if (data.event === "FINISH" && data.data?.waba_id && data.data?.phone_number_id) {
          selected.current = { wabaId: String(data.data.waba_id), phoneNumberId: String(data.data.phone_number_id) }
          void submit()
        }
      } catch { /* Eventos de outras janelas não são parte do cadastro. */ }
    }
    window.addEventListener("message", listener)
    cleanup.current = () => { window.clearTimeout(timer); window.removeEventListener("message", listener) }
    fb.login(response => {
      if (response.authResponse?.code) { code.current = response.authResponse.code; void submit() }
      else { cleanup.current(); setBusy(false); setError("Cadastro cancelado ou sem autorização da Meta.") }
    }, { config_id: config.configId, response_type: "code", override_default_response_type: true, extras: { setup: {} } })
  }

  if (!config?.available) return <p className="mt-2 text-xs text-amber-800">Conexão com um clique aguardando configuração da aplicação Meta pelo responsável da plataforma.</p>
  return <div className="mt-3"><button type="button" disabled={!ready || busy} onClick={start} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Conectando..." : "Conectar com a Meta"}</button><p className="mt-1 text-xs text-slate-500">Entre na Meta, escolha a empresa e confirme o número. Você não precisa copiar tokens.</p>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>
}
