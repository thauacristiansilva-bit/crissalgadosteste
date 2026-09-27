"use client"

import { useEffect, useState } from "react"
import { StoreLandingPage } from "@/components/store/store-landing-page"
import { previewStore } from "@/lib/ai/preview-store"
import { isStoreOpenNow } from "@/lib/operations"
import type { Product, StoreSettings } from "@/lib/types"
import type { SetupPlan } from "@/lib/ai/store-setup"

type PreviewMessage = { type: "saborflow:ai-landing-preview"; settings: StoreSettings; products: Product[]; plan: SetupPlan; basePath: string }

export function AiLandingPreview() {
  const [data, setData] = useState<PreviewMessage | null>(null)
  const [page, setPage] = useState<"landing" | "menu">("landing")
  useEffect(() => {
    if (window.parent === window) return
    const receive = (event: MessageEvent<PreviewMessage>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "saborflow:ai-landing-preview") return
      if (!event.data.settings || !Array.isArray(event.data.products) || !event.data.plan) return
      setData(event.data)
    }
    window.addEventListener("message", receive)
    window.parent.postMessage({ type: "saborflow:ai-landing-ready" }, window.location.origin)
    return () => window.removeEventListener("message", receive)
  }, [])
  if (!data) return <p className="p-8 text-center text-sm text-gray-500">Preparando visualização da loja…</p>
  const simulated = previewStore(data.settings, data.products, data.plan)
  const theme = simulated.settings
  const mode = theme.menuLayout || "grid"
  return <div aria-label="Visualização antes da publicação">
    <div className="sticky top-0 z-50 flex gap-2 border-b bg-white p-3 text-xs font-bold"><button type="button" onClick={() => setPage("landing")} className={`rounded-lg px-3 py-2 ${page === "landing" ? "bg-gray-950 text-white" : "bg-gray-100"}`}>Página inicial</button><button type="button" onClick={() => setPage("menu")} className={`rounded-lg px-3 py-2 ${page === "menu" ? "bg-gray-950 text-white" : "bg-gray-100"}`}>Cardápio</button></div>
    {page === "landing" ? <div className="[&_a]:pointer-events-none [&_button]:pointer-events-none [&_iframe]:pointer-events-none"><StoreLandingPage settings={theme} products={simulated.products} basePath={data.basePath} openNow={isStoreOpenNow(theme)} /></div> :
      <main className="min-h-screen p-4 sm:p-8" style={{ backgroundColor: theme.menuBackgroundColor || theme.backgroundColor }}>
        <div className="mx-auto max-w-6xl"><div className="rounded-2xl p-8 text-white" style={{ background: `linear-gradient(135deg, ${theme.menuPrimaryColor || theme.primaryColor}, ${theme.menuSecondaryColor || theme.secondaryColor})` }}><h1 className="text-3xl font-black">{theme.storeName}</h1><p>{theme.slogan || "Nosso cardápio"}</p></div><h2 className="my-6 text-2xl font-black">Cardápio</h2>
          <div className={mode === "list" ? "grid gap-4 sm:grid-cols-2" : mode === "cards" ? "grid grid-cols-2 gap-4 md:grid-cols-3" : "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4"}>{simulated.products.filter((item) => item.active).slice(0, 20).map((item) => <article key={item.id} className={`${mode === "list" ? "flex gap-3" : ""} ${mode === "grid" ? "" : "rounded-2xl border bg-white p-3 shadow-sm"}`}><div className={`aspect-square overflow-hidden rounded-xl bg-gray-100 ${mode === "list" ? "w-24 shrink-0" : ""}`}>{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-4xl">🥟</span>}</div><div className="pt-2"><strong className="text-sm">{item.name}</strong><p className="text-sm font-bold" style={{ color: theme.menuPrimaryColor || theme.primaryColor }}>{new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(item.price)}</p></div></article>)}</div>
        </div>
      </main>}
  </div>
}
