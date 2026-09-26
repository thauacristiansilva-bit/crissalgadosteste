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
  return <div className="[&_a]:pointer-events-none [&_button]:pointer-events-none [&_iframe]:pointer-events-none" aria-label="Visualização antes da publicação">
    <StoreLandingPage settings={simulated.settings} products={simulated.products} basePath={data.basePath} openNow={isStoreOpenNow(simulated.settings)} />
  </div>
}
