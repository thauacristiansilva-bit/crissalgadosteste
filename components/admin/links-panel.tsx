"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, ExternalLink, QrCode, Share2 } from "lucide-react"
import type { StoreSettings } from "@/lib/types"

export function LinksPanel({
  settings,
  organizationSlug,
  demoMode = false,
}: {
  settings: StoreSettings
  organizationSlug?: string | null
  demoMode?: boolean
}) {
  const [origin, setOrigin] = useState("")

  useEffect(() => setOrigin(window.location.origin), [])

  const base = useMemo(() => {
    if (!origin) return "https://seu-dominio.com"
    if (organizationSlug) return `${origin}/loja/${encodeURIComponent(organizationSlug)}`
    return origin
  }, [organizationSlug, origin])

  const links = useMemo(() => {
    const site = base
    const catalog = `${base}/cardapio`
    const order = `${base}/pedir`

    return demoMode
      ? [
          ["Página DEMO", site, "Apresentação da empresa no ambiente temporário."],
          ["Cardápio DEMO", catalog, "Abre diretamente os produtos da DEMO."],
          ["Pedido DEMO", order, "Link direto para começar um pedido na DEMO."],
        ]
      : [
          ["Site da empresa", site, "Landing page com fotos, história, localização, redes e botões de pedido."],
          ["Cardápio", catalog, "Ideal para bio, Google ou clientes que querem consultar produtos."],
          ["Pedido direto", order, "Ideal para WhatsApp, campanhas e clientes que já querem comprar."],
          ["Link para Instagram", `${site}?origem=instagram`, "Use na bio ou em campanhas para identificar a origem futuramente."],
          ["Link para WhatsApp", `${order}?origem=whatsapp`, "Leva direto ao fluxo de pedido vindo do WhatsApp."],
        ]
  }, [base, demoMode])

  function qr(url: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}`
  }

  async function share(url: string) {
    if (navigator.share) {
      await navigator.share({ title: demoMode ? "SaborFlow Demo" : settings.storeName, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">{demoMode ? "Links e códigos QR da DEMO" : "Links e códigos QR"}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {demoMode
            ? "Todos os links abaixo pertencem exclusivamente a este ambiente DEMO temporário."
            : "Agora sua empresa tem página de apresentação, cardápio e pedido direto separados."}
        </p>
        {!demoMode && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            Em domínio próprio, a estrutura fica ainda mais simples: <strong>/</strong> para o site, <strong>/cardapio</strong> para produtos e <strong>/pedir</strong> para pedido direto.
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {links.map(([title, url, description]) => (
          <section key={title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
              <div className="flex items-center justify-center rounded-2xl bg-gray-50 p-3">
                <img src={qr(url)} alt={`QR ${title}`} className="h-40 w-40" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-blue-700" />
                  <h2 className="text-lg font-black">{title}</h2>
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
                <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 break-all text-sm font-bold text-blue-700">
                  {url}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => navigator.clipboard.writeText(url)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-black">
                    <Copy className="h-4 w-4" />Copiar
                  </button>
                  <button onClick={() => share(url)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-black text-white">
                    <Share2 className="h-4 w-4" />Compartilhar
                  </button>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
