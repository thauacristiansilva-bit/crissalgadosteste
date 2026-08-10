declare global {
  interface Window {
    L?: any
  }
}

const LEAFLET_VERSION = "1.9.4"
const LEAFLET_SCRIPT = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`

let leafletPromise: Promise<any> | null = null

export function mapTileUrl() {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
}

export function mapTileAttribution() {
  return process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}

export function loadLeaflet() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("O mapa só pode ser carregado no navegador."))
  }

  if (window.L?.map) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-cris-leaflet="true"]')) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = LEAFLET_CSS
      link.dataset.crisLeaflet = "true"
      document.head.appendChild(link)
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-cris-leaflet="true"]')
    if (existing) {
      const startedAt = Date.now()
      const timer = window.setInterval(() => {
        if (window.L?.map) {
          window.clearInterval(timer)
          resolve(window.L)
        } else if (Date.now() - startedAt > 15000) {
          window.clearInterval(timer)
          reject(new Error("Tempo esgotado ao carregar o mapa."))
        }
      }, 100)
      return
    }

    const script = document.createElement("script")
    script.src = LEAFLET_SCRIPT
    script.async = true
    script.defer = true
    script.dataset.crisLeaflet = "true"
    script.onload = () => {
      if (window.L?.map) resolve(window.L)
      else reject(new Error("Leaflet não ficou disponível após o carregamento."))
    }
    script.onerror = () => reject(new Error("Não foi possível carregar o mapa OpenStreetMap."))
    document.head.appendChild(script)
  })

  return leafletPromise
}
