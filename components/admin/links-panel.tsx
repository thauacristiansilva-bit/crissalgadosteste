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

  const welcome = useMemo(() => {
    if (!origin) return "https://seu-dominio.com"

    if (demoMode && organizationSlug) {
      return `${origin}/loja/${encodeURIComponent(organizationSlug)}`
    }

    return origin
  }, [demoMode, organizationSlug, origin])

  const products = `${welcome}#cardapio`

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

  const links = demoMode
    ? [["Página DEMO", welcome], ["Cardápio DEMO", products]]
    : [["Página de boas-vindas", welcome], ["Página de produtos", products]]

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">{demoMode ? "Links e códigos QR da DEMO" : "Links e códigos QR"}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {demoMode
            ? "Todos os links abaixo pertencem exclusivamente a este ambiente DEMO temporário."
            : "Compartilhe seu cardápio em WhatsApp, Instagram, cartões e mesas."}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {links.map(([title, url]) => (
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
                <p className="mt-4 text-xs text-gray-400">
                  {demoMode
                    ? "QR temporário da DEMO. Ele deixa de funcionar quando o ambiente expirar."
                    : "Você também pode baixar o QR pela própria imagem usando o navegador."}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
