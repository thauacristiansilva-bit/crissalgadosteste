"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, LoaderCircle, TriangleAlert, XCircle } from "lucide-react"
import type { CommercialBillingStatus } from "@/lib/billing-types"

export function CheckoutReturn() {
  const [status, setStatus] = useState<CommercialBillingStatus | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    async function refresh() {
      try {
        const response = await fetch("/api/billing/status?refresh=1", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Não foi possível consultar o pagamento.")
        if (!active) return
        setStatus(payload)

        const checkout = payload.latestCheckout
        const finished =
          (checkout?.status === "completed" && checkout?.subscriptionStatus === "active") ||
          ["failed", "canceled", "expired"].includes(String(checkout?.status || "")) ||
          attempts >= 15
        if (finished) return

        attempts += 1
        timer = setTimeout(refresh, 2000)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível consultar o pagamento.")
      }
    }

    void refresh()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [])

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
        <TriangleAlert className="mb-3 h-7 w-7" />
        <p className="font-black">Não foi possível confirmar agora</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-gray-200 bg-white p-6">
        <LoaderCircle className="h-6 w-6 animate-spin text-amber-600" />
        <div>
          <p className="font-black">Confirmando pagamento</p>
          <p className="text-sm text-gray-500">O SaborFlow está consultando o provedor diretamente.</p>
        </div>
      </div>
    )
  }

  const checkout = status.latestCheckout
  const paymentConfirmed = checkout?.status === "completed" && checkout.subscriptionStatus === "active"

  if (paymentConfirmed) {
    const subscription = status.billing?.subscription
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-black">Pagamento confirmado</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {subscription?.planName
            ? <>Sua assinatura <strong>{subscription.planName}</strong> foi ativada pelo backend após confirmação do provedor.</>
            : <>Sua assinatura foi ativada pelo backend após confirmação do provedor.</>}
        </p>
        <a
          href={status.hasOrganization ? "/admin" : "/admin/nova-empresa"}
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
        >
          {status.hasOrganization ? "Voltar ao painel" : "Configurar minha primeira loja"}
        </a>
      </div>
    )
  }

  if (checkout && ["failed", "canceled", "expired"].includes(checkout.status)) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-7 text-red-950">
        <XCircle className="h-8 w-8 text-red-600" />
        <h2 className="mt-4 text-xl font-black">Pagamento não concluído</h2>
        <p className="mt-2 text-sm leading-relaxed">
          O checkout ficou com status <strong>{checkout.status}</strong>. Sua assinatura anterior, quando existir, não é alterada por uma tentativa não confirmada.
        </p>
        <a href="/contratar" className="mt-5 inline-flex rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-black">
          Voltar aos planos
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7 text-amber-950">
      <LoaderCircle className="h-8 w-8 animate-spin text-amber-600" />
      <h2 className="mt-4 text-xl font-black">Pagamento ainda em processamento</h2>
      <p className="mt-2 text-sm leading-relaxed">
        O novo checkout continua com status <strong>{checkout?.subscriptionStatus || "pending"}</strong>. A tela consulta o provedor por alguns segundos; você também pode voltar mais tarde sem perder o checkout.
      </p>
      {checkout?.checkoutUrl && (
        <a href={checkout.checkoutUrl} className="mt-5 inline-flex rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-black">
          Voltar ao pagamento
        </a>
      )}
    </div>
  )
}
