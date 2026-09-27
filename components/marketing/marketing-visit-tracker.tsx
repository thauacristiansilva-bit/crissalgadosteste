"use client"

import { useEffect } from "react"

export function MarketingVisitTracker({ page }: { page: "inicio" | "planos" | "demo" }) {
  useEffect(() => {
    try {
      // Uma sessão por aba. Sem IP, email, cookie de terceiros ou identificação do cliente.
      const key = "saborflow:marketing-session"
      let id = sessionStorage.getItem(key)
      if (!id) {
        id = crypto.randomUUID()
        sessionStorage.setItem(key, id)
      }
      void fetch("/api/marketing/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, sessionId: id }),
        keepalive: true,
      }).catch(() => undefined)
    } catch {
      // Se o navegador bloquear o armazenamento, a página continua funcionando.
    }
  }, [page])
  return null
}
